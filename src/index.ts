import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => {
  return c.json({ message: 'Hello from Hono API!' });
});

app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/users', (c) => {
  const users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];
  return c.json({ users });
});

app.post('/api/users', async (c) => {
  const body = await c.req.json();
  return c.json({ 
    message: 'User created',
    user: body 
  }, 201);
});

export default app;
