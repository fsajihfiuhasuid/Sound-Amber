const DB_NAME = 'sound-amber-v1'
const STORE_NAME = 'ambers'
const DB_VERSION = 1

let dbPromise

function openDatabase() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  return dbPromise
}

function runTransaction(mode, operation) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode)
        const store = transaction.objectStore(STORE_NAME)
        const request = operation(store)
        transaction.oncomplete = () => resolve(request?.result)
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      }),
  )
}

export async function loadAmbers() {
  const all = await runTransaction('readonly', (store) => store.getAll())
  return (all || []).sort((a, b) => a.serial - b.serial)
}

export function saveAmber(amber) {
  return runTransaction('readwrite', (store) => store.put(amber))
}

export function removeAmber(id) {
  return runTransaction('readwrite', (store) => store.delete(id))
}

export async function patchAmber(id, patch) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const getRequest = store.get(id)
    getRequest.onsuccess = () => {
      if (!getRequest.result) {
        reject(new Error('Amber not found'))
        return
      }
      store.put({ ...getRequest.result, ...patch })
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}
