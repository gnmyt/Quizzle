const DB_NAME = 'QuizzleImageCache';
const DB_VERSION = 1;
const STORE_NAME = 'images';

class ImageCacheUtil {
    constructor() {
        this.db = null;
        this.initPromise = this.initDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, {keyPath: 'id'});
                    store.createIndex('questionUuid', 'questionUuid', {unique: false});
                    store.createIndex('timestamp', 'timestamp', {unique: false});
                }
            };
        });
    }

    async ensureDB() {
        if (!this.db) {
            await this.initPromise;
        }
        return this.db;
    }

    async storeImage(questionUuid, file, imageType = 'question', answerIndex = null) {
        await this.ensureDB();

        const suffix = imageType === 'answer' ? `_answer_${answerIndex}` : '';
        const imageId = `${questionUuid}${suffix}_${Date.now()}`;
        const arrayBuffer = await file.arrayBuffer();

        const imageData = {
            id: imageId, questionUuid: questionUuid, imageType: imageType, answerIndex: answerIndex,
            filename: file.name, mimeType: file.type, size: file.size, data: arrayBuffer, timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(imageData);

            request.onsuccess = () => resolve(imageId);
            request.onerror = () => reject(request.error);
        });
    }

    async getImage(imageId) {
        if (!imageId) return null;

        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(imageId);

            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    const blob = new Blob([result.data], {type: result.mimeType});
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(blob);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteImage(imageId) {
        if (!imageId) return false;

        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(imageId);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteImagesForQuestion(questionUuid) {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('questionUuid');
            const request = index.openCursor(IDBKeyRange.only(questionUuid));

            let deleteCount = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    deleteCount++;
                    cursor.continue();
                } else {
                    resolve(deleteCount);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
}

export const imageCache = new ImageCacheUtil();

export {ImageCacheUtil};