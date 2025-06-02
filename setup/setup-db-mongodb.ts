import { MongoClient } from 'mongodb';

async function setupMongoDB() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB');

    // Select the database
    const db = client.db('Farming');

    // Get collections (created automatically when data is inserted)
    const farms = db.collection('farms');
    const crops = db.collection('crops');
    const harvests = db.collection('harvests');

    // Insert farms
    const farm1 = await farms.insertOne({ name: 'Green Acres', location: 'California' });
    const farm1Id = farm1.insertedId;
    const farm2 = await farms.insertOne({ name: 'Sunny Fields', location: 'Texas' });
    const farm2Id = farm2.insertedId;

    // Insert crops with references to farms
    const crop1 = await crops.insertOne({
      farm_id: farm1Id,
      type: 'wheat',
      planting_date: new Date('2025-03-01')
    });
    const crop1Id = crop1.insertedId;

    const crop2 = await crops.insertOne({
      farm_id: farm1Id,
      type: 'corn',
      planting_date: new Date('2025-04-01')
    });
    const crop2Id = crop2.insertedId;

    const crop3 = await crops.insertOne({
      farm_id: farm2Id,
      type: 'soybeans',
      planting_date: new Date('2025-03-15')
    });
    const crop3Id = crop3.insertedId;

    // Insert harvests with references to crops
    await harvests.insertOne({
      crop_id: crop1Id,
      harvest_date: new Date('2025-07-01'),
      quantity: 10.5
    });

    await harvests.insertOne({
      crop_id: crop2Id,
      harvest_date: new Date('2025-08-15'),
      quantity: 15.0
    });

    await harvests.insertOne({
      crop_id: crop3Id,
      harvest_date: new Date('2025-09-01'),
      quantity: 8.0
    });

    console.log('MongoDB setup completed successfully.');
  } catch (err) {
    console.error('Error setting up MongoDB:', err);
  } finally {
    // Close the connection
    await client.close();
  }
}

// Run the setup function
setupMongoDB().catch(console.error);