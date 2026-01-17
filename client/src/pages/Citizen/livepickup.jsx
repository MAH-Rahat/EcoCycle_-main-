// src/LivePickupStatus.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const LivePickupStatus = () => {
  const [pickupStatus, setPickupStatus] = useState(null);

  useEffect(() => {
    // Assuming you have an endpoint to get the current status of a pickup
    axios.get('http://localhost:5000/api/pickup/status')  // Replace with your actual endpoint
      .then(response => {
        setPickupStatus(response.data.status);
      })
      .catch(error => {
        console.error('Error fetching pickup status:', error);
      });
  }, []);

  return (
    <div>
      <h1>Your Pickup Status</h1>
      <p>{pickupStatus ? pickupStatus : "Fetching status..."}</p>
    </div>
  );
};

export default LivePickupStatus;
