import { MongoClient } from "mongodb";

// Manuel olarak URI'yi buraya ekleyin (TEST AMAÇLI)
const uri = process.env.MONGODB_URI

const options = {
  connectTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  serverSelectionTimeoutMS: 5000,
};

let client;
let clientPromise;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}
 
// Test fonksiyonu ekleyelim
export async function testConnection() {
  try {
    const client = await clientPromise;
    await client.db().admin().ping();
    console.log("MongoDB bağlantısı başarılı!");
    return true;
  } catch (error) {
    console.error("MongoDB bağlantı testi başarısız:", error);
    return false;
  }
}

// Bağlantı fonksiyonu
export async function connectToDatabase() {
  try {
    const client = await clientPromise;
    return {
      client,
      db: client.db(),
    };
  } catch (error) {
    console.error("MongoDB bağlantı hatası:", error);
    throw new Error("Veritabanına bağlanılamadı");
  }
}

// Uygulama başlar başlamaz bağlantıyı test et
testConnection();