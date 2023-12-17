let createError = require("http-errors");
let express = require("express");
const cors = require("cors");
let path = require("path");
let cookieParser = require("cookie-parser");
let logger = require("morgan");
require("dotenv").config();
let indexRouter = require("./routes/index");
const axios = require("axios");
const admin = require("firebase-admin");

let app = express();

app.use(cors());

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

admin.initializeApp({
  databaseURL:
    "https://radio-metsiot-default-rtdb.europe-west1.firebasedatabase.app/",
  credential: admin.credential.cert(
    "./radio-metsiot-firebase-adminsdk-fju3q-4807a55213.json"
  ),
});

const PLAYING_DATA_URL =
  "https://carina.streamerr.co:2020/json/stream/metsiot1";
const PLAYING_DATA_URL_HE =
  "https://carina.streamerr.co:2020/json/stream/metsiot2";

const dbLastSync = admin.database().ref("/lastSync");

const getPlayingData = async function (lang, url) {
  console.log("Get Playing Data");
  try {
    const dbRef = admin
      .database()
      .ref("/playingData" + (lang === "he" ? "He" : ""));
    const res = await axios.get(url);

    if (res.status !== 200) {
      console.error("Request to get data error", res.data);
    }

    const { nowplaying } = res.data;

    const isProgram =
      (nowplaying.match(/((jingle)|(jngle))( ){1,2}-.*/gi) || []).length > 0;

    let currentProgram = null;

    if (isProgram) {
      currentProgram = nowplaying
        .match(/((jingle)|(jngle))( ){1,2}-.*/gi)
        ?.shift()
        ?.replace(/((jingle)|(jngle))( ){1,2}-/gi, "");
    }

    try {
      if (!isProgram) await dbRef.child("title").update({ title: nowplaying });
      else await dbRef.child("currentProgram").update({ currentProgram });
    } catch (error) {
      console.error("Save to database error", lang, error);
    }
  } catch (error) {
    console.error("Request to get data error", lang, error);
  }
};

async function main() {
  setInterval(async () => {
    try {
      await Promise.all([
        getPlayingData("he", PLAYING_DATA_URL_HE),
        getPlayingData("en", PLAYING_DATA_URL),
      ]);
      await dbLastSync.child("date").set(new Date().toISOString());
    } catch (error) {
      console.error(error);
    }
  }, 5000);
}

main();

module.exports = app;
