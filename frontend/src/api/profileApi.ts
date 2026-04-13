import axios from 'axios';

const client = axios.create({
  baseURL: '/api/profile',
  headers: { 'Content-Type': 'application/json' },
});

// TODO: define profile CRUD, leaderboard, and clan calls as Dev D builds the service
export const profileApi = {
  client,
};
