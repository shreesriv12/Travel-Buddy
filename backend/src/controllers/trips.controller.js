import prisma from '../config/db.js';
// CREATE a new trip
export const createTrip = async (req, res) => {
  const userId = req.user.userId;
  const { title, destination, destination_coords, start_date, end_date, status, total_budget, summary } = req.body;

  try {
    const trip = await prisma.trip.create({
      data: {
        user_id: userId,
        title,
        destination,
        destination_coords,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        status,
        total_budget,
        summary
      }
    });
    res.status(201).json(trip);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
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
    res.json(trips);
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
    res.json(trip);
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
