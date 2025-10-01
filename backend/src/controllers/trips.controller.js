import prisma from '../config/db.js';

// CREATE a new trip
export const createTrip = async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized: user not found' });
  }

  const {
    title,
    origin,
    origin_coords,
    destination,
    destination_coords,
    start_date,
    end_date,
    adults,
    status,
    total_budget,
    summary
  } = req.body;

  // Debug: log request body
  console.log('req.body:', req.body);

  // Prepare trip data safely
  const tripData = {
    user_id: userId,
    title: title || 'Untitled Trip',
    origin: origin ?? 'Unknown', // only fallback if null or undefined
    origin_coords: typeof origin_coords === 'object' ? origin_coords : {},
    destination: destination || 'Unknown Destination',
    destination_coords: typeof destination_coords === 'object' ? destination_coords : {},
    start_date: start_date ? new Date(start_date) : new Date(),
    end_date: end_date ? new Date(end_date) : new Date(),
    adults: adults !== undefined ? Number(adults) : 1,
    status: status || 'planned',
    total_budget: total_budget !== undefined ? Number(total_budget) : 0,
    summary: summary || {}
  };

  // Debug: log the final data sent to Prisma
  console.log('tripData:', tripData);

  try {
    const trip = await prisma.trip.create({ data: tripData });
    res.status(201).json({ success: true, trip });
  } catch (err) {
    console.error('Prisma createTrip error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// GET all trips for the current user
export const getTrips = async (req, res) => {
  const userId = req.user.userId;

  try {
    const trips = await prisma.trip.findMany({
      where: { user_id: userId },
      orderBy: { start_date: 'asc' }
    });
    res.json({ success: true, trips });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET a single trip by ID
export const getTripById = async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;

  try {
    const trip = await prisma.trip.findFirst({
      where: { id, user_id: userId }
    });
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    res.json({ success: true, trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// UPDATE a trip
export const updateTrip = async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  const data = req.body;

  try {
    const trip = await prisma.trip.updateMany({
      where: { id, user_id: userId },
      data
    });
    if (trip.count === 0) return res.status(404).json({ message: 'Trip not found or not authorized' });
    res.json({ message: 'Trip updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE a trip
export const deleteTrip = async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;

  try {
    const trip = await prisma.trip.deleteMany({
      where: { id, user_id: userId }
    });
    if (trip.count === 0) return res.status(404).json({ message: 'Trip not found or not authorized' });
    res.json({ message: 'Trip deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
