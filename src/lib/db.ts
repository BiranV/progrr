// Mock Database Logic
class LocalAuth {
  storageKey: string;
  usersKey: string;

  constructor() {
    this.storageKey = "progrr_session";
    this.usersKey = "progrr_users";
  }

  async me() {
    if (typeof window === "undefined") return null;
    const session = localStorage.getItem(this.storageKey);
    if (!session) throw new Error("Not authenticated");
    return JSON.parse(session);
  }

  async login(email: string, password: string) {
    if (typeof window === "undefined") throw new Error("Client side only");
    const users = JSON.parse(localStorage.getItem(this.usersKey) || "[]");
    const user = users.find(
      (u: any) => u.email === email && u.password === password
    );
    if (!user) throw new Error("Invalid credentials");

    const { password: _, ...userWithoutPassword } = user;
    localStorage.setItem(this.storageKey, JSON.stringify(userWithoutPassword));
    return userWithoutPassword;
  }

  async register(userData: any) {
    if (typeof window === "undefined") throw new Error("Client side only");
    const users = JSON.parse(localStorage.getItem(this.usersKey) || "[]");
    if (users.find((u: any) => u.email === userData.email)) {
      throw new Error("User already exists");
    }

    const newUser = { id: Date.now().toString(), ...userData, role: "admin" }; // Default to admin for now
    users.push(newUser);
    localStorage.setItem(this.usersKey, JSON.stringify(users));

    const { password: _, ...userWithoutPassword } = newUser;
    localStorage.setItem(this.storageKey, JSON.stringify(userWithoutPassword));
    return userWithoutPassword;
  }

  async logout() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(this.storageKey);
  }

  async isAuthenticated() {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(this.storageKey);
  }
}

class LocalEntity {
  entityName: string;
  storageKey: string;

  constructor(entityName: string) {
    this.entityName = entityName;
    this.storageKey = `progrr_entity_${entityName}`;
  }

  _getData() {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem(this.storageKey) || "[]");
  }

  _saveData(data: any[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  async list() {
    return this._getData();
  }

  async get(id: string) {
    const item = this._getData().find((i: any) => i.id === id);
    if (!item) throw new Error("Not found");
    return item;
  }

  async create(data: any) {
    const items = this._getData();
    const newItem = {
      id: Date.now().toString(),
      created_date: new Date().toISOString(),
      ...data,
    };
    items.push(newItem);
    this._saveData(items);
    return newItem;
  }

  async update(id: string, data: any) {
    const items = this._getData();
    const index = items.findIndex((i: any) => i.id === id);
    if (index === -1) throw new Error("Not found");

    items[index] = { ...items[index], ...data };
    this._saveData(items);
    return items[index];
  }

  async delete(id: string) {
    const items = this._getData();
    const newItems = items.filter((i: any) => i.id !== id);
    this._saveData(newItems);
  }

  async filter(criteria: any) {
    const items = this._getData();
    return items.filter((item: any) => {
      for (const key in criteria) {
        if (item[key] !== criteria[key]) return false;
      }
      return true;
    });
  }
}

const entitiesHandler = {
  get: function (target: any, prop: string, receiver: any) {
    if (!target[prop]) {
      target[prop] = new LocalEntity(prop);
    }
    return target[prop];
  },
};

export const db = {
  auth: new LocalAuth(),
  entities: new Proxy({}, entitiesHandler) as any, // Use any to allow dynamic entity access
  appLogs: {
    logUserInApp: async (pageName: string) => {
      // console.log(`[Mock] Logged user visit to: ${pageName}`);
      return true;
    },
  },
};
