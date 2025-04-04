import { useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  LocationOn,
  CalendarToday,
  Group,
  LocalOffer,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const weatherOptions = ['Warm & Sunny', 'Moderate Climate', 'Cool & Snowy'];
const environmentOptions = ['Urban City', 'Rural Countryside', 'Coastal Beach'];
const activityOptions = ['Relaxing & Leisure', 'Adventure & Outdoors', 'Cultural & Historical'];

interface Trip {
  id: number;
  title: string;
  destination: string;
  date: string;
  travelers: number;
  tags: string[];
  image: string;
  status: 'completed' | 'upcoming' | 'planning';
}

const mockTrips: Trip[] = [
  {
    id: 1,
    title: 'Summer Beach Vacation',
    destination: 'Bali, Indonesia',
    date: '2024-07-15',
    travelers: 4,
    tags: ['Beach', 'Relaxation', 'Adventure'],
    image: 'https://source.unsplash.com/random/800x600/?beach',
    status: 'upcoming',
  },
  {
    id: 2,
    title: 'City Explorer',
    destination: 'New York, USA',
    date: '2024-03-20',
    travelers: 2,
    tags: ['City', 'Culture', 'Shopping'],
    image: 'https://source.unsplash.com/random/800x600/?city',
    status: 'planning',
  },
  {
    id: 3,
    title: 'Mountain Retreat',
    destination: 'Swiss Alps',
    date: '2023-12-10',
    travelers: 3,
    tags: ['Mountains', 'Skiing', 'Nature'],
    image: 'https://source.unsplash.com/random/800x600/?mountains',
    status: 'completed',
  },
];

export default function Dashboard() {
  const [isEditing, setIsEditing] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [userData, setUserData] = useState({
    email: 'user@example.com',
    username: 'TravelEnthusiast',
    memberSince: '2024-01-01',
    tripsPlanned: 3,
    preferences: {
      weather: 'Warm & Sunny',
      environment: 'Coastal Beach',
      activity: 'Adventure & Outdoors',
    },
  });

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
  };

  const handleDialogOpen = () => {
    setOpenDialog(true);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
  };

  const TripCard = ({ trip }: { trip: Trip }) => (
    <Card
      component={motion.div}
      whileHover={{ y: -5 }}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <CardMedia
        component="img"
        height="200"
        image={trip.image}
        alt={trip.title}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography gutterBottom variant="h6" component="h2">
          {trip.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <LocationOn sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="body2" color="text.secondary">
            {trip.destination}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <CalendarToday sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="body2" color="text.secondary">
            {trip.date}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Group sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="body2" color="text.secondary">
            {trip.travelers} travelers
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {trip.tags.map((tag) => (
            <Chip
              key={tag}
              icon={<LocalOffer />}
              label={tag}
              size="small"
              variant="outlined"
            />
          ))}
        </Box>
      </CardContent>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <IconButton size="small">
          <EditIcon />
        </IconButton>
        <IconButton size="small" color="error">
          <DeleteIcon />
        </IconButton>
      </Box>
    </Card>
  );

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Personal Info Section */}
        <Grid item xs={12} md={4}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Personal Info</Typography>
              <IconButton onClick={handleEdit} size="small">
                <EditIcon />
              </IconButton>
            </Box>
            {isEditing ? (
              <Box component="form" sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  label="Email"
                  value={userData.email}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Username"
                  value={userData.username}
                  sx={{ mb: 2 }}
                />
                <Button variant="contained" onClick={handleSave}>
                  Save Changes
                </Button>
              </Box>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  Email: {userData.email}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Username: {userData.username}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Member since: {userData.memberSince}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Trips planned: {userData.tripsPlanned}
                </Typography>
              </>
            )}
          </Paper>
        </Grid>

        {/* Preferences Section */}
        <Grid item xs={12} md={4}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              Travel Preferences
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Weather Preference</InputLabel>
              <Select
                value={userData.preferences.weather}
                label="Weather Preference"
              >
                {weatherOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Environment Preference</InputLabel>
              <Select
                value={userData.preferences.environment}
                label="Environment Preference"
              >
                {environmentOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Activity Preference</InputLabel>
              <Select
                value={userData.preferences.activity}
                label="Activity Preference"
              >
                {activityOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" fullWidth>
              Save Preferences
            </Button>
          </Paper>
        </Grid>

        {/* Trip History Section */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h6">Trip History</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleDialogOpen}
            >
              New Trip
            </Button>
          </Box>
          <Grid container spacing={3}>
            {mockTrips.map((trip) => (
              <Grid item xs={12} sm={6} md={4} key={trip.id}>
                <TripCard trip={trip} />
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>

      {/* New Trip Dialog */}
      <Dialog open={openDialog} onClose={handleDialogClose}>
        <DialogTitle>Create New Trip</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Trip Title"
            fullWidth
            variant="outlined"
          />
          <TextField
            margin="dense"
            label="Destination"
            fullWidth
            variant="outlined"
          />
          <TextField
            margin="dense"
            label="Date"
            type="date"
            fullWidth
            variant="outlined"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            margin="dense"
            label="Number of Travelers"
            type="number"
            fullWidth
            variant="outlined"
            InputProps={{ inputProps: { min: 1 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button variant="contained" onClick={handleDialogClose}>
            Create Trip
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 