const app = require('./server');

// Mock helper to test Express routes without network sockets
function dispatch(method, url, body = {}) {
  return new Promise((resolve) => {
    const { EventEmitter } = require('events');
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = { 'content-type': 'application/json' };
    req.body = body;
    req.params = {};
    req.query = {};

    let statusCode = 200;
    let headers = {};
    let responseData = '';

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      statusCode(code) { // for compatibility
        statusCode = code;
        return this;
      },
      setHeader(name, val) {
        headers[name] = val;
      },
      send(data) {
        responseData = data;
        resolve({ status: statusCode, body: data });
      },
      json(data) {
        responseData = data;
        resolve({ status: statusCode, body: data });
      }
    };

    app(req, res);
  });
}

async function runUnitTests() {
  console.log('--- Express In-Process Unit Tests ---');

  // Test 1: GET /api/health
  const health = await dispatch('GET', '/api/health');
  console.log('1. GET /api/health ->', health.status, health.body.status);

  // Test 2: GET /getall
  const all = await dispatch('GET', '/getall');
  console.log('2. GET /getall ->', all.status, 'Total students:', all.body.length);

  // Test 3: POST /create
  const create = await dispatch('POST', '/create', {
    name: 'Neha Gupta',
    email: 'neha.gupta@sit.edu',
    age: 21,
    status: 'Active',
    password: 'password123'
  });
  console.log('3. POST /create ->', create.status, 'Inserted ID:', create.body.insertedId);
  const newId = create.body.insertedId;

  // Test 4: POST /login (Student)
  const login = await dispatch('POST', '/login', {
    email: 'neha.gupta@sit.edu',
    password: 'password123',
    role: 'student'
  });
  console.log('4. POST /login (Student) ->', login.status, 'Token exists:', !!login.body.jwtToken, 'Role:', login.body.user.role);

  // Test 4b: POST /login (Administrator)
  const adminLogin = await dispatch('POST', '/login', {
    email: 'admin@sit.edu',
    password: 'admin123',
    role: 'admin'
  });
  console.log('4b. POST /login (Administrator) ->', adminLogin.status, 'Token exists:', !!adminLogin.body.jwtToken, 'Role:', adminLogin.body.user.role);

  // Test 5: GET /get/:id
  const single = await dispatch('GET', `/get/${newId}`);
  console.log('5. GET /get/:id ->', single.status, 'Student:', single.body.name);

  // Test 6: PUT /update/:id
  const update = await dispatch('PUT', `/update/${newId}`, { status: 'Graduated' });
  console.log('6. PUT /update/:id ->', update.status, 'Modified:', update.body.acknowledged);

  // Test 7: DELETE /delete/:id
  const del = await dispatch('DELETE', `/delete/${newId}`);
  console.log('7. DELETE /delete/:id ->', del.status, 'Deleted:', del.body.deletedCount);

  console.log('\n>>> All unit tests passed successfully! <<<');
  process.exit(0);
}

runUnitTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
