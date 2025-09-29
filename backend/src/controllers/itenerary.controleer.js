import prisma from '../config/db.js';

// Create a new itinerary item for a trip
export const createItineraryItem = async (req, res) => {
  const userId = req.user.userId;
  const { tripId } = req.params;
  const {
    day_number,
    title,
    description,
    start_time,
    end_time,
    location,
    location_coords,
    category,
    estimated_cost,
    sort_order
  } = req.body;

  try {
    // Ensure the trip belongs to the user
    const trip = await prisma.trip.findFirst({ where: { id: tripId, user_id: userId } });
    if (!trip) return res.status(404).json({ message: 'Trip not found or not authorized' });

    const item = await prisma.itineraryItem.create({
      data: {
        trip_id: tripId,
        day_number,
        title,
        description,
        start_time: new Date(start_time),
        end_time: new Date(end_time),
        location,
        location_coords,
        category,
        estimated_cost,
        sort_order
      }
    });

    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all itinerary items for a trip
export const getItineraryItems = async (req, res) => {
  const userId = req.user.userId;
  const { tripId } = req.params;

  try {
    const trip = await prisma.trip.findFirst({ where: { id: tripId, user_id: userId } });
    if (!trip) return res.status(404).json({ message: 'Trip not found or not authorized' });

    const items = await prisma.itineraryItem.findMany({
      where: { trip_id: tripId },
      orderBy: { day_number: 'asc' }
    });

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update an itinerary item
export const updateItineraryItem = async (req, res) => {
  const userId = req.user.userId;
  const { tripId, itemId } = req.params;
  const data = req.body;

  try {
    // Ensure the trip belongs to the user
    const trip = await prisma.trip.findFirst({ where: { id: tripId, user_id: userId } });
    if (!trip) return res.status(404).json({ message: 'Trip not found or not authorized' });

    const item = await prisma.itineraryItem.updateMany({
      where: { id: itemId, trip_id: tripId },
      data
    });

    if (item.count === 0) return res.status(404).json({ message: 'Item not found' });

    res.json({ message: 'Itinerary item updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete an itinerary item
export const deleteItineraryItem = async (req, res) => {
  const userId = req.user.userId;
  const { tripId, itemId } = req.params;

  try {
    const trip = await prisma.trip.findFirst({ where: { id: tripId, user_id: userId } });
    if (!trip) return res.status(404).json({ message: 'Trip not found or not authorized' });

    const item = await prisma.itineraryItem.deleteMany({
      where: { id: itemId, trip_id: tripId }
    });

    if (item.count === 0) return res.status(404).json({ message: 'Item not found' });

    res.json({ message: 'Itinerary item deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
