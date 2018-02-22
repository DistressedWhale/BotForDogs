"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const request = require("request");
const fs = require("fs");
const jsongetter = require("get-json");
const sleep = require('sleep');

const app = express();
var lastMessage = "";

app.set("port", (process.env.PORT || 5000));

//Allow processing of data
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());


let token = "ENTER YOUR API TOKEN HERE"
let verifyToken = "ENTER YOUR VERIFY TOKEN HERE"

//The webpage itself
app.get("/", function(req, res) {
  res.send("Hi, this is a facebook chatbot hosted on heroku. Try it at {Link to your facebook page here}}")
});



//Facebook
//check password is correct
app.get("/webhook/", function(req, res) {
  if (req.query["hub.verify_token"] === verifyToken) {
    res.send(req.query["hub.challenge"])
  }
  res.send("Wrong token")
});

/**
 * Gets the current date, formatted in DD/MM/YY and returns it as a string
 */
function getDate() {
  var time = new Date();
  return ((time.getDay() + 1) + "/" + (time.getMonth() + 1) + "/" + time.getFullYear());
}

/**
 * Gets a specific XKCD and sends its data in the order: safe_title, num, alt, and then img.
 * @param {ID} sender 
 * @param {Integer} xkcdNum 
 */
function getSpecificXKCD(sender, xkcdNum) {
  var url = "https://xkcd.com/" + xkcdNum + "/info.0.json"

  jsongetter(url, function(error, response) {
    if (error) {
      console.log(error)
    } else if (response) {
      sendText(sender, ("Title: " + response.safe_title + "\nNumber: " + response.num + "\nAlt text: " + response.alt + ""))
      sendImage(sender, response.img)
    }
  });
}


/**
 * Gets a random XKCD and sends its data in the order: safe_title, num, alt, and then img.
 * @param {ID} sender 
 */
function getRandomXKCD(sender) {
  //Find the most recent XKCD
  var url = "https://xkcd.com/info.0.json";

  jsongetter(url, function(error, response) {
    if (error) {
      console.log(error)
    } else if (response) {
      var randID = Math.floor((Math.random() * response.num) + 1);
      getSpecificXKCD(sender, randID)
    }
  })
}

/**
 * Gets the most recent XKCD and sends its data in the order: safe_title, num, alt, and then img.
 * @param {ID} sender
 */

function getLatestXKCD(sender) {
  var url = "https://xkcd.com/info.0.json";

  jsongetter(url, function(error, response) {
    if (error) {
      console.log(error)
    } else if (response) {
      console.log("Sending XKCD number: " + response.num);
      sendText(sender, ("Title: " + response.safe_title + "\nNumber: " + response.num + "\nAlt text: " + response.alt + ""))
      sendImage(sender, response.img)
    }
  });
}

/**
 * Returns an array of lines from a file
 * @param {String} filename 
 */
function fileToArray(filename) {
  var file = fs.readFileSync("./" + filename, "utf8");
  return file.split("\n");
}

/**
 * Picks a random line from a file and returns it as a string
 * @param {String} filename 
 */
function giveRandomLine(filename) {
  var lines = fileToArray(filename);
  var line = lines[Math.floor(Math.random()*lines.length)];
  return line;
}

/**
 * Picks a random quote from grabs.txt
 * @param {ID} sender 
 */
function quote(sender) {
  sendText(sender, giveDog("grabs.txt"))
}

/**
 * Picks the most recent non-command message, and adds it to grabs.txt
 * @param {ID} sender 
 */
function grab(sender) {
  fs.appendFile('grabs.txt', (getDate() + " - \"" + lastMessage + "\"\n"), function (err) {
    if (err) throw err;
    console.log('Saved ' + lastMessage);
    sendText(sender, "Saved \"" + lastMessage + "\"");
  });
}


/**
 * Compares a string to each of the command triggers. Runs a command if it matches one.
 * @param {ID} sender 
 * @param {String} text 
 */
function responseTriggers(sender, text) {
  var lct = text.toLowerCase();

  switch (lct) {
    case "woof":
      sendText(sender, "Woof!")  
      break;

    case "!dog":
      sendImage(sender, giveDog("dogs.txt"))
      break;

    case "!commands":
      sendText(sender, "!dog - returns a random dog\n" +
                       "!grab - saves the most recent message\n" + 
                       "!quote - returns a random grab\n" +
                       "!xkcd - returns a random xkcd comic\n" + 
                       "!xkcd [x] - returns a specific xkcd\n" +
                       "!xkcd latest - returns the most recent xkcd");
      break;

    case "!grab":
      grab(sender)
      break;

    case "!quote":
      quote(sender)
      break;

    case "!xkcd":
      getRandomXKCD(sender)
      break;

    default:
      if (lct.includes("drop table") || lct.includes("drop all table")) {
        sendText(sender, "I dont even have any tables to drop, silly");

      } else if (lct.includes("good dog") || lct.includes("good bot")) {
        sendText(sender, "Thanks :D")

      } else if (lct.includes("bad dog") || lct.includes("bad bot")) {
        sendText(sender, "I'm sorry, I'll try better next time :(")

      } else if (lct.match(/!xkcd [0-9]{1,4}/)) {
        var num = lct.substring(6, lct.length)
        console.log("Going to try getting XKCD with num = " + num)
        getSpecificXKCD(sender, num)

      } else if (lct.match(/(!xkcd l)|(!xkcd latest)/)) {
        getLatestXKCD(sender);

      } else if (lct.charAt(0) === "!") {
        sendText(sender, "I'm not sure what you mean")
      }
  }
}

//POST
app.post("/webhook/", function(req,res) {
  let messaging_events = req.body.entry[0].messaging
  for (let i = 0; i < messaging_events.length; i++) {
    let event = messaging_events[i]
    let sender = event.sender.id
    if (event.message && event.message.text) {
      let text = event.message.text
      console.log("Recieved message: " + text)
      responseTriggers(sender, text)
      if (text.charAt(0) !== "!") {
        lastMessage = text
      }
    }
  }
  res.sendStatus(200) //everything went ok
})

/**
 * Sends a text message
 * @param {ID} sender 
 * @param {String} text 
 */
function sendText(sender, text) {
  let messageData = {text: text}
  if (text === "") {
    console.log("Text cannot be empty")
  } else {
    request ({
      url: "https://graph.facebook.com/v2.6/me/messages",
      qs : {access_token: token},
      method: "POST",
      json: {
        recipient: {id: sender},
        message : messageData
      }
    }, function(error, response, body) {
      if (error) {
        console.log("sending error")
      } else if (response.body.error) {
        console.log(response.body.error.message)
      } else {
        console.log("Sent message " + text)
      }
    })
  }
}

/**
 * Sends an image from a URL
 * @param {ID} sender 
 * @param {String} url 
 */
function sendImage(sender, url) {
  let imageURL = {text: url};

  request ({
    url: "https://graph.facebook.com/v2.6/me/messages",
    qs : {access_token: token},
    method: "POST",
    json: {
      recipient: {id: sender},
      message : {
        attachment: {
          type: "image",
          payload: {
            url: url,
            is_reusable: true
          }
        }
      }
    }
  },
  function(error, response, body) {
    if (error) {
      console.log(error)
    } else if (response.body.error) {
      console.log(response.body.error.message)
    } else {
      console.log("Sent image: " + url)
    }
  })
}

//start server
app.listen(app.get("port"), function() {
  console.log("running on port" )
})
