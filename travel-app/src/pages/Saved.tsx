import { Box, Typography, Grid, Card, CardContent, CardMedia, IconButton } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';

export default function Saved() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Saved Destinations
      </Typography>

      <Grid container spacing={3}>
        {[1, 2, 3].map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item}>
            <Card>
              <CardMedia
                component="img"
                height="200"
                image={`https://source.unsplash.com/random/800x600/?travel,${item}`}
                alt="Saved Destination"
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">Saved Destination {item}</Typography>
                  <IconButton size="small" color="error">
                    <DeleteIcon />
                  </IconButton>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Your saved destination with notes and details.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
} 