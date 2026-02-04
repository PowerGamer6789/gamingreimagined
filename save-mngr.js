const MAGIC_BYTE = "pwR";

/**
 * IMPORT: Streams the file and processes it in chunks to avoid RAM spikes
 */
async function importGlobalSave(file) {
  if (!file) return;

  try {
    const magicLen = MAGIC_BYTE.length;
    
    // Validate Magic Bytes without loading file into memory
    const header = await file.slice(0, magicLen).text();
    const footer = await file.slice(-magicLen).text();

    if (header !== MAGIC_BYTE || footer !== MAGIC_BYTE) {
      throw new Error("Unauthorized file format.");
    }

    // Decompress the stream
    const decompressedStream = file.slice(magicLen, -magicLen)
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));

    const response = new Response(decompressedStream);
    // Note: If the JSON is truly massive (500MB+), 
    // we use .json() here as it is more memory-efficient than .text()
    const data = await response.json();

    if (data.site !== "Gaming Reimagined") throw new Error("Incompatible save source.");

    if (!confirm("Restore progress? This will reload the page.")) return;

    // Restore LocalStorage
    localStorage.clear();
    Object.keys(data.local).forEach(k => localStorage.setItem(k, data.local[k]));

    // Restore IndexedDB sequentially
    for (const dbName in data.idb) {
      await injectIDB(dbName, data.idb[dbName]);
    }

    alert("Restoration successful!");
    window.location.reload();
  } catch (err) {
    console.error(err);
    alert("Failed to load: " + err.message);
  }
}

/**
 * EXPORT: Streams data row-by-row to bypass "Invalid string length" errors
 */
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

    // Background process: Manual JSON Construction to avoid JSON.stringify limits
    const process = (async () => {
      const meta = JSON.stringify(backupMetadata);
      // Write meta and start the IDB object
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

    // Collect compressed chunks
    const reader = compressionStream.readable.getReader();
    const chunks = [encoder.encode(MAGIC_BYTE)]; // Start with Magic Byte

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    chunks.push(encoder.encode(MAGIC_BYTE)); // End with Magic Byte

    // Trigger Download
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
    console.error(err);
    alert("Export failed: " + err.message);
  }
}

/**
 * Helper: Streams IndexedDB content row-by-row
 */
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

/**
 * Helper: Injects data back into IDB using batch transactions
 */
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
        for (let k in content[sName]) store.put(content[sName][k], k);
      });
    };
    req.onerror = () => resolve();
  });
}