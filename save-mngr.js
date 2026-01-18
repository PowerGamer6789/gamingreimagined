const MAGIC_BYTE = "pwR";

async function importGlobalSave(file) {
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const magicLen = MAGIC_BYTE.length;

    const decoder = new TextDecoder();
    const header = decoder.decode(bytes.slice(0, magicLen));
    const footer = decoder.decode(bytes.slice(-magicLen));

    if (header !== MAGIC_BYTE || footer !== MAGIC_BYTE) {
      throw new Error("Unauthorized file format.");
    }

    const compressedData = bytes.slice(magicLen, -magicLen);

    const decompressionStream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream("gzip"));
    const decompressedResponse = new Response(decompressionStream);
    const jsonString = await decompressedResponse.text();
    const data = JSON.parse(jsonString);

    if (data.site !== "Gaming Reimagined") {
      throw new Error("Incompatible save source.");
    }

    if (!confirm("Restore progress?")) return;

    Object.keys(data.local).forEach(k => localStorage.setItem(k, data.local[k]));

    for (let dbName in data.idb) {
      await injectIDB(dbName, data.idb[dbName]);
    }

    alert("Restoration successful!");
    window.location.reload();
  } catch (err) {
    alert("Failed to load: " + err.message);
  }
}

async function injectIDB(name, content) {
  return new Promise((resolve) => {
    const req = indexedDB.open(name);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (let sName in content) {
        if (!db.objectStoreNames.contains(sName)) {
          db.createObjectStore(sName);
        }
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      
      for (let sName in content) {
        if (!db.objectStoreNames.contains(sName)) continue;
        
        const tx = db.transaction(sName, "readwrite");
        const store = tx.objectStore(sName);
        
        store.clear(); 
        const storeData = content[sName];
        Object.keys(storeData).forEach(k => {
          store.put(storeData[k], k);
        });
      }
      
      db.close();
      resolve();
    };
    
    req.onerror = () => resolve();
  });
}

async function exportGlobalSave() {
  try {
    const backupMetadata = {
      site: "Gaming Reimagined",
      date: new Date().toISOString(),
      local: { ...localStorage }
    };

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const process = (async () => {
      await writer.write(encoder.encode(MAGIC_BYTE));

      const compressionStream = new CompressionStream("gzip");
      const compressWriter = compressionStream.writable.getWriter();
      
      const reader = compressionStream.readable.getReader();
      const pipePromise = (async () => {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      })();

      const metaString = JSON.stringify(backupMetadata);
      await compressWriter.write(encoder.encode(metaString.slice(0, -1) + ',"idb":{'));

      if (window.indexedDB.databases) {
        const dbList = await window.indexedDB.databases();
        for (let i = 0; i < dbList.length; i++) {
          const dbName = dbList[i].name;
          if (!dbName) continue;

          const dbData = await extractIDB(dbName);
          let entry = `"${dbName}":${JSON.stringify(dbData)}`;
          if (i < dbList.length - 1) entry += ",";
          
          await compressWriter.write(encoder.encode(entry));
        }
      }

      await compressWriter.write(encoder.encode("}}"));
      await compressWriter.close();
      await pipePromise;

      await writer.write(encoder.encode(MAGIC_BYTE));
      await writer.close();
    })();

    const blob = await new Response(readable).blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_${Date.now()}.grs`;
    link.click();

    await process;
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Export failed: " + err.message);
  }
}

async function extractIDB(name) {
  return new Promise((resolve) => {
    const req = indexedDB.open(name);
    
    req.onsuccess = async () => {
      const db = req.result;
      const result = {};
      const storeNames = Array.from(db.objectStoreNames);
      
      for (const sName of storeNames) {
        result[sName] = await new Promise((res) => {
          const storeMap = {};
          const tx = db.transaction(sName, "readonly");
          const store = tx.objectStore(sName);
          const cursorReq = store.openCursor();

          cursorReq.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              storeMap[cursor.key] = cursor.value;
              cursor.continue();
            } else {
              res(storeMap);
            }
          };

          cursorReq.onerror = () => res({});
        });
      }
      
      db.close();
      resolve(result);
    };

    req.onerror = () => resolve({});
  });
}


