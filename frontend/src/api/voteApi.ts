import axios from 'axios';

const client = axios.create({
  baseURL: '/api/vote',
  headers: { 'Content-Type': 'application/json' },
});

// TODO: define upload URL, session creation, and vote submission calls as Dev C builds the service
export const voteApi = {
  client,
};
