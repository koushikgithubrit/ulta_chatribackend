const express = require('express');
const mongoose = require('mongoose');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
const port = 8080;


app.use(cors()); 
app.use(express.json()); 

// Firebase Admin SDK Connecting
const serviceAccount = require('./ultrachatri-firebase-adminsdk-6pacg-0b87d795dd.json'); // Download this from Firebase console
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://ultrachatri-default-rtdb.firebaseio.com/"
});

// MongoDB Connecting
mongoose.connect('mongodb+srv://koushikadakka2004:0oCUzSVRYA8wrSM1@logindatabase.f1qljez.mongodb.net/?retryWrites=true&w=majority&appName=loginDataBase', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define schemas and models
const rainStatusSchema = new mongoose.Schema({
  rainStatus: Number,
  timestamp: { type: Date, default: Date.now }
});

const umbrellaStateSchema = new mongoose.Schema({
  ledState: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});

const RainStatus = mongoose.model('RainStatus', rainStatusSchema);
const UmbrellaState = mongoose.model('UmbrellaState', umbrellaStateSchema);

// Reference to Firebase Realtime Database path
const db = admin.database();
const ref = db.ref("/rainStatus");
const umbrellaRef = db.ref("/umbrellaStatus");  // Firebase reference

// Function to update rain status in MongoDB
async function updateRainStatus(rainStatus) {
  try {
    const existingDoc = await RainStatus.findOne({});
    
    if (existingDoc) {
      existingDoc.rainStatus = rainStatus;
      existingDoc.timestamp = new Date(); // Update timestamp
      await existingDoc.save();
      console.log('Rain status updated in existing MongoDB document');
    } else {
      const newRainStatus = new RainStatus({ rainStatus });
      await newRainStatus.save();
      console.log('Rain status saved to new MongoDB document');
    }
  } catch (error) {
    console.error('Error updating MongoDB:', error);
  }
}

//Listen changes to the rain status in Firebase
ref.on('value', async (snapshot) => {
  const rainStatus = snapshot.val();
  console.log('Rain status changed:', rainStatus);
  
  // Update MongoDB with the new rain status
  await updateRainStatus(rainStatus);
});

// Function to sync umbrella state to Firebase
async function syncUmbrellaStateToFirebase(ledState) {
  try {
    await umbrellaRef.set(ledState); // Set the value in Firebase
    console.log('Umbrella state synced to Firebase');
  } catch (error) {
    console.error('Error syncing umbrella state to Firebase:', error);
  }
}

// Route to get rain status from MongoDB
app.get('/rainstatus', async (req, res) => {
  try {
    const rainStatus = await RainStatus.findOne(); // Get the most recent rain status
    if (rainStatus) {
      res.json(rainStatus);
    } else {
      res.status(404).json({ message: 'Rain status not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching rain status', error });
  }
});

// Route to get umbrella state (LED state) from MongoDB
app.get('/umbrellastate', async (req, res) => {
  try {
    const umbrellaState = await UmbrellaState.findOne(); // Get the most recent umbrella state
    if (umbrellaState) {
      res.json(umbrellaState);
    } else {
      res.status(404).json({ message: 'Umbrella state not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching umbrella state', error });
  }
});

// Route to update umbrella state (LED state) in MongoDB and sync to Firebase
app.post('/umbrellastate', async (req, res) => {
  const { ledState } = req.body;

  try {
    // Check if a document already exists in the UmbrellaState collection
    const existingDoc = await UmbrellaState.findOne({});
    
    if (existingDoc) {
      // Update the existing document with the new ledState and timestamp
      existingDoc.ledState = ledState;
      existingDoc.timestamp = new Date(); // Update timestamp
      await existingDoc.save();
      console.log('Umbrella state updated in existing MongoDB document');
    } else {
      // Create a new document if none exists
      const newUmbrellaState = new UmbrellaState({ ledState });
      await newUmbrellaState.save();
      console.log('Umbrella state saved to new MongoDB document');
    }

    // Sync umbrella state to Firebase
    await syncUmbrellaStateToFirebase(ledState);

    res.json({ message: 'Umbrella state updated and synced to Firebase' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating umbrella state', error });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
