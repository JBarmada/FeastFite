import axios from 'axios';

const client = axios.create({
  baseURL: '/api/economy',
  headers: { 'Content-Type': 'application/json' },
});

// TODO: define balance, shop, and purchase calls as Dev D builds the service
export const economyApi = {
  client,
};
