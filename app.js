const express = require("express");
const jwt = require("jsonwebtoken");

const bcrypt = require("bcrypt");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log(`Server is Running at http://localhost:3000/`);
    });
  } catch (e) {
    console.log(`DB Error :${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send(`Invalid JWT Token`);
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", (error, payload) => {
      if (error) {
        response.status(401);
        response.send(`Invalid JWT Token`);
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send(`Invalid user`);
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send(`Invalid password`);
    }
  }
});

//API for get states
app.get("/states/", authentication, async (request, response) => {
  const getAllStatesQuery = `SELECT * FROM state;`;
  const states = await db.all(getAllStatesQuery);
  response.send(states);
});

//API for get state
app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const selectStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const state = await db.get(selectStateQuery);
  response.send(state);
});

//API add district
app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
  VALUES (
      '${districtName}',
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths}
    );`;
  await db.run(addDistrictQuery);
  response.send(`District Successfully Added`);
});

//API for get specific district
app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictsQuery = `SELECT * FROM district;`;
    const districts = await db.all(getDistrictsQuery);
    response.send(districts);
  }
);

//API for delete district from district table
app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send(`District Removed`);
  }
);

//API for updating district
app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `UPDATE district
    SET 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send(`District Details Updated`);
  }
);

//API for getting statics from join on states and districts
app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const getStatsQuery = `
    SELECT 
        SUM(district.cases) AS totalCases,
        SUM(district.cured) AS totalCured,
        SUM(district.active) AS totalActive,
        SUM(district.deaths) AS totalDeaths
    FROM district JOIN state ON district.state_id = state.state_id;
    `;
    const dbResponse = await db.get(getStatsQuery);
    response.send(dbResponse);
  }
);
module.exports = app;
