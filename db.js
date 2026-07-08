const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Simple helper to read/write JSON files with thread-safety locks (in-memory lock)
const locks = {};

function acquireLock(name) {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (!locks[name]) {
        locks[name] = true;
        resolve();
      } else {
        setTimeout(tryAcquire, 5);
      }
    };
    tryAcquire();
  });
}

function releaseLock(name) {
  locks[name] = false;
}

const db = {
  async getCollectionPath(name) {
    return path.join(DATA_DIR, `${name}.json`);
  },

  async loadCollection(name) {
    const filePath = await this.getCollectionPath(name);
    await acquireLock(name);
    try {
      if (!fs.existsSync(filePath)) {
        return [];
      }
      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data || '[]');
    } catch (e) {
      console.error(`Error loading collection ${name}:`, e);
      return [];
    } finally {
      releaseLock(name);
    }
  },

  async saveCollection(name, data) {
    const filePath = await this.getCollectionPath(name);
    await acquireLock(name);
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error(`Error saving collection ${name}:`, e);
      return false;
    } finally {
      releaseLock(name);
    }
  },

  // CRUD API
  async find(collectionName, query = {}) {
    const items = await this.loadCollection(collectionName);
    return items.filter(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });
  },

  async findOne(collectionName, query = {}) {
    const items = await this.loadCollection(collectionName);
    return items.find(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  async insert(collectionName, doc) {
    const items = await this.loadCollection(collectionName);
    const newDoc = {
      id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...doc
    };
    items.push(newDoc);
    await this.saveCollection(collectionName, items);
    return newDoc;
  },

  async update(collectionName, query, updateObj) {
    const items = await this.loadCollection(collectionName);
    let updatedCount = 0;
    const updatedItems = items.map(item => {
      let matches = true;
      for (const key in query) {
        if (item[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        updatedCount++;
        return {
          ...item,
          ...updateObj,
          updatedAt: new Date().toISOString()
        };
      }
      return item;
    });
    if (updatedCount > 0) {
      await this.saveCollection(collectionName, updatedItems);
    }
    return updatedCount;
  },

  async delete(collectionName, query) {
    const items = await this.loadCollection(collectionName);
    const initialLength = items.length;
    const remainingItems = items.filter(item => {
      let matches = true;
      for (const key in query) {
        if (item[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      return !matches;
    });
    const deletedCount = initialLength - remainingItems.length;
    if (deletedCount > 0) {
      await this.saveCollection(collectionName, remainingItems);
    }
    return deletedCount;
  }
};

module.exports = db;
