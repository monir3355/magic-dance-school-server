const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middle ware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized Access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized Access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ztxo0js.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const userCollection = client.db("magicDanceArts").collection("users");
    const instructorCollection = client
      .db("magicDanceArts")
      .collection("instructors");
    const classCollection = client.db("magicDanceArts").collection("classes");

    // jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // verify jwt admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };
    // verify jwt Instructors
    const verifyInstructors = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // user
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    // user create
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        res.status(400).send({ message: "User already exists!" });
      } else {
        const result = await userCollection.insertOne(user);
        res.send(result);
      }
    });
    // jwt email check the instructor
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const user = await userCollection.findOne({ email: email });
      const insertResult = { admin: user?.role === "admin" };
      res.send(insertResult);
    });
    // jwt email check the instructor
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }
      const user = await userCollection.findOne({ email: email });
      const insertResult = { instructor: user?.role === "instructor" };
      res.send(insertResult);
    });
    // set admin here
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const insertResult = await userCollection.updateOne(filter, updatedDoc);
      res.send(insertResult);
    });
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "instructor",
        },
      };
      const insertResult = await userCollection.updateOne(filter, updatedDoc);
      res.send(insertResult);
    });
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const insertResult = await userCollection.deleteOne(query);
      res.send(insertResult);
    });

    // classes
    app.get("/classes", verifyJWT, async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    // get your all class by email
    app.get("/classes/:email", async (req, res) => {
      const result = await classCollection
        .find({ email: req.params.email })
        .toArray();
      res.send(result);
    });
    // class post
    app.post("/classes", verifyJWT, verifyInstructors, async (req, res) => {
      const addClass = req.body;
      const insertResult = await classCollection.insertOne(addClass);
      res.send(insertResult);
    });

    // classes update by instructor
    app.patch("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedClasses = req.body;
      console.log(updatedClasses);
      const classes = {
        $set: {
          class_name: updatedClasses.class_name,
          image: updatedClasses.image,
          available_seats: updatedClasses.available_seats,
          price: updatedClasses.price,
          details: updatedClasses.details,
          status: updatedClasses.status,
        },
      };
      const result = await classCollection.updateOne(filter, classes, options);
      res.send(result);
    });

    // classes approved
    app.patch("/classes/approved/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "approved",
        },
      };
      const insertResult = await classCollection.updateOne(filter, updatedDoc);
      res.send(insertResult);
    });

    // classes denied
    app.patch("/classes/denied/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "denied",
        },
      };
      const insertResult = await classCollection.updateOne(filter, updatedDoc);
      res.send(insertResult);
    });

    // classes feedback
    app.patch("/classes/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const feedback = req.body.feedback; // Assuming the feedback is sent in the request body

      const updatedDoc = {
        $set: {
          feedback: feedback,
        },
      };

      try {
        const insertResult = await classCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(insertResult);
      } catch (error) {
        res.status(500).send("Error updating feedback");
      }
    });

    // Instructors
    app.get("/instructors", async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Magic Dance Arts server is running...");
});
app.listen(port, () => {
  console.log(`Magic Dance Arts server is running on PORT ${port}`);
});
