var express = require("express");
var cors = require("cors");
var app = express();
const axios = require("axios");
var bodyParser = require("body-parser");

app.use(cors());
app.use(bodyParser.json());

app.get("/events/:token", async function (req, res) {
  const token = req.params.token;
  const options = {
    method: "GET",
    url: "https://api.courier.com/events",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  axios
    .request(options)
    .then((response) =>
      res.json(response.data.results.map((record) => record.event))
    );
});

app.post("/profiles", async (req, res) => {
  const body = req.body;
  const courierAuthToken = req.headers.authorization.replace("Bearer ", "");

  await Promise.all(
    body.users.map((user) => {
      const options = {
        method: "PUT",
        url: `https://api.courier.com/profiles/${user.id}`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${courierAuthToken}`,
        },
        data: {
          profile: user?.profile ?? {},
        },
      };
      return axios.request(options);
    })
  );

  res
    .status(200)
    .json({ message: `Successfully created ${body.users.length} users` });
});

app.delete("/profiles/:id", async (req, res) => {
  const id = req.params.id;
  const courierAuthToken = req.headers.authorization.replace("Bearer ", "");

  const options = {
    method: "DELETE",
    url: `https://api.courier.com/profiles/${id}`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierAuthToken}`,
    },
  };

  await axios.request(options);

  res.status(200).json({ message: `Successfully deleted user with id: ${id}` });
});

app.post("/send", async (req, res) => {
  const body = req.body;
  const courierAuthToken = req.headers.authorization.replace("Bearer ", "");

  await Promise.all(
    body.messages.map((message) => {
      const options = {
        method: "POST",
        url: "https://api.courier.com/send",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${courierAuthToken}`,
        },
        data: {
          message,
        },
      };

      return axios.request(options);
    })
  );

  res.json({ message: "Successfully sent message" });
});

app.listen(9050, function () {
  console.log("CORS-enabled web server listening on port 9050");
});
