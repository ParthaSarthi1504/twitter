const express = require("express");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const format = require("date-fns/addDays");

const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDBtoServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost3000");
    });
  } catch (err) {
    console.log(`DB Error: ${err.message}`);
    process.exit(1);
  }
};
initializeDBtoServer();

//POST API

app.post("/register", async (request, response) => {
  const { username, name, password, gender } = request.body;
  let hashPassword = await bcrypt.hash(password, 10);
  let SqlUserNameQuery = `
        SELECT *
        FROM user
        WHERE username = '${username}'
        ;`;
  let dbUserName = await db.get(SqlUserNameQuery);
  if (dbUserName !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      let createUserSqlQuery = `
            INSERT INTO user
            (
            username,
            password,
            name,
            gender
            )
            VALUES
            (
            '${username}',
             '${hashPassword}',
            '${name}',
            '${gender}'
            );
          `;
      let AccountCreate = await db.run(createUserSqlQuery);
      response.send("User created successfully");
    }
  }
});

//POST API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  let SqlUserCheckQuery = `
        SELECT *
        FROM user
        WHERE username = '${username}'
        ;`;
  let dbUser = await db.get(SqlUserCheckQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    let isCorrectPassword = await bcrypt.compare(password, dbUser.password);
    if (isCorrectPassword === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status("400");
      response.send("Invalid password");
    }
  }
});

//Authentication

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.AccountHolder = payload.username;
        next();
      }
    });
  }
};

//ALL API

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let AccountHolder = request.AccountHolder;

  let findingUserSqlQuery = `
        SELECT *
        FROM user
        WHERE user.username = '${AccountHolder}'
  ;`;
  let LoggedUserDetails = await db.get(findingUserSqlQuery);
  LoggedUserId = LoggedUserDetails.user_id;

  let SqlAllQuery = `
        SELECT 
            user.username,
            T.tweet,
            T.date_time AS dateTime
        FROM 
        (follower INNER JOIN tweet ON follower.following_user_id = tweet.user_id) AS T
         INNER JOIN user ON T.user_id = user.user_id
        WHERE T.follower_user_id = '${LoggedUserId}'
        ORDER BY
            tweet.date_time DESC
        LIMIT
            4;
    `;
  let allLatestTweet = await db.all(SqlAllQuery);
  response.send(allLatestTweet);
});

//ALL API

app.get("/user/following/", authenticateToken, async (request, response) => {
  let AccountHolder = request.AccountHolder;

  let findingUserSqlQuery = `
        SELECT *
        FROM user
        WHERE user.username = '${AccountHolder}'
  ;`;
  let LoggedUserDetails = await db.get(findingUserSqlQuery);
  LoggedUserId = LoggedUserDetails.user_id;

  let SqlAllUserQuery = `
        SELECT 
            DISTINCT user.name AS name
        FROM 
            follower INNER JOIN user ON follower.following_user_id = user.user_id 
        WHERE follower.follower_user_id = '${LoggedUserId}'
        ORDER BY user.user_id;
    `;
  let allFollowingUsers = await db.all(SqlAllUserQuery);
  response.send(allFollowingUsers);
});

//ALL API

app.get("/user/followers/", authenticateToken, async (request, response) => {
  let AccountHolder = request.AccountHolder;

  let findingUserSqlQuery = `
        SELECT *
        FROM user
        WHERE user.username = '${AccountHolder}'
  ;`;
  let LoggedUserDetails = await db.get(findingUserSqlQuery);
  LoggedUserId = LoggedUserDetails.user_id;

  let SqlAllFollowerQuery = `
        SELECT 
            DISTINCT user.name AS name
        FROM 
            follower INNER JOIN user ON follower.follower_user_id = user.user_id 
        WHERE follower.following_user_id = '${LoggedUserId}'
        ORDER BY user.user_id;
    `;
  let allFollowers = await db.all(SqlAllFollowerQuery);
  response.send(allFollowers);
});

//GET API

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  let AccountHolder = request.AccountHolder;

  let findingUserSqlQuery = `
        SELECT *
        FROM user
        WHERE user.username = '${AccountHolder}'
  ;`;
  let LoggedUserDetails = await db.get(findingUserSqlQuery);
  LoggedUserId = LoggedUserDetails.user_id;

  const { tweetId } = request.params;
  const tweetsQuery = `
    SELECT
    *
    FROM tweet
    WHERE tweet_id=${tweetId};
    `;
  const tweetResult = await db.get(tweetsQuery);
  const userFollowersQuery = `
    SELECT
    *
    FROM follower INNER JOIN user on user.user_id = follower.following_user_id
    WHERE follower.follower_user_id = ${LoggedUserId};`;
  const userFollowers = await db.all(userFollowersQuery);
  if (
    userFollowers.some((item) => item.following_user_id === tweetResult.user_id)
  ) {
    let FinalResultQuery = `
                SELECT
                    tweet.tweet,
                    COUNT(like.like_id) AS likes,
                    COUNT(reply.reply) AS replies,
                    tweet.date_time AS dateTime
                FROM tweet LEFT JOIN like ON tweet.tweet_id = like.tweet_id
                LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id
                WHERE tweet.tweet_id= ${tweetId}
        ;`;
    let getSpecificTweet = await db.get(FinalResultQuery);
    response.send(getSpecificTweet);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//GET API

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    let AccountHolder = request.AccountHolder;

    let findingUserSqlQuery = `
        SELECT *
        FROM user
        WHERE user.username = '${AccountHolder}'
  ;`;
    let LoggedUserDetails = await db.get(findingUserSqlQuery);
    LoggedUserId = LoggedUserDetails.user_id;

    const { tweetId } = request.params;
    const tweetsQuery = `
    SELECT
    *
    FROM tweet
    WHERE tweet_id=${tweetId};
    `;
    const tweetResult = await db.get(tweetsQuery);
    const userFollowersQuery = `
    SELECT
    *
    FROM follower INNER JOIN user on user.user_id = follower.following_user_id
    WHERE follower.follower_user_id = ${LoggedUserId};`;
    const userFollowers = await db.all(userFollowersQuery);
    if (
      userFollowers.some(
        (item) => item.following_user_id === tweetResult.user_id
      )
    ) {
      let FinalResultQuery = `
                SELECT
                    user.username
                FROM like INNER JOIN user ON like.user_id = user.user_id
                WHERE like.tweet_id= ${tweetId}
        ;`;
      let getUserLikes = await db.all(FinalResultQuery);
      let likes = getUserLikes.map((eachUser) => eachUser.username);
      response.send({ likes });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//GET API

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    let AccountHolder = request.AccountHolder;

    let findingUserSqlQuery = `
        SELECT *
        FROM user
        WHERE user.username = '${AccountHolder}'
  ;`;
    let LoggedUserDetails = await db.get(findingUserSqlQuery);
    LoggedUserId = LoggedUserDetails.user_id;

    const { tweetId } = request.params;
    const tweetsQuery = `
    SELECT
    *
    FROM tweet
    WHERE tweet_id=${tweetId};
    `;
    const tweetResult = await db.get(tweetsQuery);
    const userFollowersQuery = `
    SELECT
    *
    FROM follower INNER JOIN user on user.user_id = follower.following_user_id
    WHERE follower.follower_user_id = ${LoggedUserId};`;
    const userFollowers = await db.all(userFollowersQuery);
    if (
      userFollowers.some(
        (item) => item.following_user_id === tweetResult.user_id
      )
    ) {
      let SqlReplyQuery = `
                SELECT
                   name,reply
                FROM reply INNER JOIN user ON reply.user_id = user.user_id
                WHERE tweet_id= ${tweetId}
        ;`;
      let replies = await db.all(SqlReplyQuery);

      response.send({ replies });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//GET API

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let AccountHolder = request.AccountHolder;

  let findingUserSqlQuery = `
        SELECT *
        FROM user
        WHERE user.username = '${AccountHolder}'
  ;`;
  let LoggedUserDetails = await db.get(findingUserSqlQuery);
  LoggedUserId = LoggedUserDetails.user_id;

  let SqlAccessAllTweetQuery = `
        SELECT 
            tweet.tweet,
            COUNT(like.like_id) AS likes,
            COUNT(reply.reply) AS replies,
            tweet.date_time AS dateTime
        FROM 
        tweet LEFT JOIN like ON tweet.tweet_id = like.tweet_id
        LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id
        WHERE 
            tweet.user_id  = ${LoggedUserId}
        GROUP BY 
            tweet.tweet_id;
    `;
  let AccessAllTweet = await db.all(SqlAccessAllTweetQuery);
  response.send(AccessAllTweet);
});

//POST API

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  let AccountHolder = request.AccountHolder;

  let findingUserSqlQuery = `
        SELECT *
        FROM user
        WHERE user.username = '${AccountHolder}'
  ;`;
  let LoggedUserDetails = await db.get(findingUserSqlQuery);
  LoggedUserId = LoggedUserDetails.user_id;

  let formatedDate = format(new Date(), "MM-dd-yyyy HH:mm:ss");
  const { tweet } = request.body;

  let SqlPostQuery = `
        INSERT INTO tweet
        (tweet,user_id,date_time)
        VALUES (
        '${tweet}',
        ${LoggedUserId},
        '${formatedDate}'
        );`;
  await db.run(SqlPostQuery);
  response.send("Created a Tweet");
});

//DELETE API

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    let AccountHolder = request.AccountHolder;

    let findingUserSqlQuery = `
        SELECT *
        FROM user
        WHERE username = '${AccountHolder}'
  ;`;
    let LoggedUserDetails = await db.get(findingUserSqlQuery);
    LoggedUserId = LoggedUserDetails.user_id;

    let { tweetId } = request.params;

    let SqlDeletedTweetQuery = `
        SELECT *
        FROM tweet
        WHERE 
            tweet_id = ${tweetId} AND user_id = ${LoggedUserId};
    `;
    let DeletedTweet = await db.get(SqlDeletedTweetQuery);
    if (DeletedTweet !== undefined) {
      let SqlTweetDeleteQuery = `
        DELETE FROM tweet
        WHERE 
            tweet_id = ${tweetId};
    `;
      await db.run(SqlTweetDeleteQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
