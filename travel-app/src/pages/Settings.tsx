import { Box, Typography, Paper, TextField, Button, FormControl, InputLabel, Select, MenuItem } from '@mui/material';

export default function Settings() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Paper sx={{ p: 3, maxWidth: 600 }}>
        <Typography variant="h6" sx={{ mb: 3 }}>
          Profile Settings
        </Typography>
        
        <TextField
          fullWidth
          label="Username"
          defaultValue="TravelEnthusiast"
          sx={{ mb: 2 }}
        />
        
        <TextField
          fullWidth
          label="Email"
          type="email"
          defaultValue="user@example.com"
          sx={{ mb: 2 }}
        />

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Language</InputLabel>
          <Select defaultValue="en" label="Language">
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="es">Spanish</MenuItem>
            <MenuItem value="fr">French</MenuItem>
            <MenuItem value="de">German</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Theme</InputLabel>
          <Select defaultValue="light" label="Theme">
            <MenuItem value="light">Light</MenuItem>
            <MenuItem value="dark">Dark</MenuItem>
            <MenuItem value="system">System</MenuItem>
          </Select>
        </FormControl>

        <Button variant="contained" color="primary">
          Save Changes
        </Button>
      </Paper>
    </Box>
  );
} 