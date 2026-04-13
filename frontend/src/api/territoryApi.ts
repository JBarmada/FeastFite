import axios from 'axios';

const client = axios.create({
  baseURL: '/api/territory',
  headers: { 'Content-Type': 'application/json' },
});

// TODO: import Territory type and define response shapes as Dev B builds the service
export const territoryApi = {
  client,
};
