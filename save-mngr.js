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
  const backup = {
    site: "Gaming Reimagined",
    date: new Date().toISOString(),
    local: { ...localStorage },
    idb: {}
  };

  try {
    if (window.indexedDB.databases) {
      const dbList = await window.indexedDB.databases();
      for (let dbInfo of dbList) {
        if (!dbInfo.name) continue;
        backup.idb[dbInfo.name] = await extractIDB(dbInfo.name);
      }
    }

    const jsonString = JSON.stringify(backup);
    const stream = new Blob([jsonString]).stream();

    const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
    const compressedResponse = new Response(compressedStream);
    const compressedBuffer = await compressedResponse.arrayBuffer();

    const magicHeader = new TextEncoder().encode(MAGIC_BYTE);
    const finalBlob = new Blob([magicHeader, compressedBuffer, magicHeader], { type: 'application/octet-stream' });
    
    const url = URL.createObjectURL(finalBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GamingReimaginedSave_${new Date().toISOString().split('T')[0]}.grs`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Error creating backup: " + err.message);
  }
}

async function extractIDB(name) {
  return new Promise((resolve) => {
    const req = indexedDB.open(name);
    
    req.onsuccess = async () => {
      const db = req.result;
      const result = {};
      const storeNames = Array.from(db.objectStoreNames);
      
      for (let sName of storeNames) {
        result[sName] = await new Promise((res) => {
          const tx = db.transaction(sName, "readonly");
          const store = tx.objectStore(sName);
          const allDataReq = store.getAll();
          const allKeysReq = store.getAllKeys();
          
          allDataReq.onsuccess = () => {
            allKeysReq.onsuccess = () => {
              const storeMap = {};
              allKeysReq.result.forEach((key, i) => {
                storeMap[key] = allDataReq.result[i];
              });
              res(storeMap);
            };
          };
          
          allDataReq.onerror = () => res({});
        });
      }
      
      db.close();
      resolve(result);
    };
    
    req.onerror = () => resolve({});
  });
}
