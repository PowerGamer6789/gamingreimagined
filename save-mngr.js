const MAGIC_BYTE = "pwR";

async function importGlobalSave(file) {
  if (!file) return;

  try {
    const magicLen = MAGIC_BYTE.length;
    
    const header = await file.slice(0, magicLen).text();
    const footer = await file.slice(-magicLen).text();

    if (header !== MAGIC_BYTE || footer !== MAGIC_BYTE) {
      throw new Error("Unauthorized or invalid file format.");
    }

    const compressedPart = file.slice(magicLen, -magicLen);

    const decompressedStream = compressedPart
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));

    const response = new Response(decompressedStream);
    const data = await response.json();

    if (data.site !== "Gaming Reimagined") throw new Error("Incompatible save source.");

    if (!confirm("Restore progress? This will reload the page and overwrite current data.")) return;

    localStorage.clear();
    if (data.local) {
      Object.keys(data.local).forEach(k => localStorage.setItem(k, data.local[k]));
    }

    if (data.idb) {
      for (const dbName in data.idb) {
        await injectIDB(dbName, data.idb[dbName]);
      }
    }

    alert("Restoration successful!");
    window.location.reload();
  } catch (err) {
    console.error("Import Error:", err);
    alert("Failed to load: " + err.message);
  }
}

async function exportGlobalSave() {
  try {
    const backupMetadata = {
      site: "Gaming Reimagined",
      date: new Date().toISOString(),
      local: { ...localStorage }
    };

    const encoder = new TextEncoder();
    const compressionStream = new CompressionStream("gzip");
    const writer = compressionStream.writable.getWriter();

    const process = (async () => {
      const meta = JSON.stringify(backupMetadata);
      await writer.write(encoder.encode(meta.slice(0, -1) + ',"idb":{'));

      const dbList = window.indexedDB.databases ? await window.indexedDB.databases() : [];
      
      for (let i = 0; i < dbList.length; i++) {
        const dbName = dbList[i].name;
        if (!dbName) continue;

        await writer.write(encoder.encode(`"${dbName}":{`));
        await streamIDBStores(dbName, writer, encoder);
        await writer.write(encoder.encode("}"));

        if (i < dbList.length - 1) await writer.write(encoder.encode(","));
      }

      await writer.write(encoder.encode("}}"));
      await writer.close();
    })();

    const reader = compressionStream.readable.getReader();
    const chunks = [encoder.encode(MAGIC_BYTE)];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    chunks.push(encoder.encode(MAGIC_BYTE));

    const blob = new Blob(chunks, { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_${Date.now()}.grs`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    await process;
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (err) {
    console.error("Export Error:", err);
    alert("Export failed: " + err.message);
  }
}

async function streamIDBStores(dbName, writer, encoder) {
  return new Promise((resolve) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = async () => {
      const db = req.result;
      const storeNames = Array.from(db.objectStoreNames);

      for (let j = 0; j < storeNames.length; j++) {
        const sName = storeNames[j];
        await writer.write(encoder.encode(`"${sName}":{`));

        await new Promise((res) => {
          const tx = db.transaction(sName, "readonly");
          const store = tx.objectStore(sName);
          const cursorReq = store.openCursor();
          let first = true;

          cursorReq.onsuccess = async (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const entry = (first ? "" : ",") + `${JSON.stringify(cursor.key)}:${JSON.stringify(cursor.value)}`;
              await writer.write(encoder.encode(entry));
              first = false;
              cursor.continue();
            } else res();
          };
          cursorReq.onerror = () => res();
        });

        await writer.write(encoder.encode("}"));
        if (j < storeNames.length - 1) await writer.write(encoder.encode(","));
      }
      db.close();
      resolve();
    };
    req.onerror = () => resolve();
  });
}

async function injectIDB(name, content) {
  return new Promise((resolve) => {
    const req = indexedDB.open(name);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const sName in content) {
        if (!db.objectStoreNames.contains(sName)) db.createObjectStore(sName);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const stores = Object.keys(content).filter(n => db.objectStoreNames.contains(n));
      if (!stores.length) return (db.close(), resolve());

      const tx = db.transaction(stores, "readwrite");
      tx.oncomplete = () => { db.close(); resolve(); };
      
      stores.forEach(sName => {
        const store = tx.objectStore(sName);
        store.clear();
        for (let k in content[sName]) {
          const key = isNaN(k) ? k : Number(k);
          store.put(content[sName][k], key);
        }
      });
    };
    req.onerror = () => resolve();
  });
}
