import { Box, Typography, Grid, Card, CardContent, CardMedia, TextField, InputAdornment } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

export default function Explore() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Explore Destinations
      </Typography>
      
      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder="Search destinations..."
        sx={{ mb: 4 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {/* Featured Destinations */}
      <Typography variant="h5" sx={{ mb: 2 }}>
        Featured Destinations
      </Typography>
      <Grid container spacing={3}>
        {[1, 2, 3, 4].map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item}>
            <Card>
              <CardMedia
                component="img"
                height="200"
                image={`https://source.unsplash.com/random/800x600/?travel,${item}`}
                alt="Destination"
              />
              <CardContent>
                <Typography variant="h6">Destination {item}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Explore this amazing destination with unique experiences and attractions.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
} 