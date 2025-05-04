import React, { useEffect, useState } from 'react';
import { Box, Heading, List, ListItem, Text } from '@chakra-ui/react';
import Amplify, { API } from 'aws-amplify';
import awsconfig from './aws-exports';
Amplify.configure(awsconfig);

function App() {
  const [alerts, setAlerts] = useState([]);
  useEffect(() => {
    API.get('notificationsApi', '/alerts')
       .then(res => setAlerts(res))
       .catch(console.error);
  }, []);
  return (
    <Box p={8}>
      <Heading mb={4}>Trip Alerts Dashboard</Heading>
      <List spacing={3}>
        {alerts.map(a=>(
          <ListItem key={a.timestamp}>
            <Text>
              🚨 <b>{a.start_city} → {a.end_city}</b> —{' '}
              {Object.entries(a.abnormal)
                .map(([k,v])=>`${k}: ${Array.isArray(v)?v.map(x=>x.status).join(','):v}`)
                .join('; ')}
            </Text>
            <Text fontSize="sm" color="gray.500">
              {new Date(a.timestamp).toLocaleString()}
            </Text>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export default App;
