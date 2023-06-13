const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const stripe = require("stripe")(process.env.PAYMENT_GETWAY_KEY);
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

    const paymentCollection = client
      .db("magicDanceArts")
      .collection("payments");

    const instructorCollection = client
      .db("magicDanceArts")
      .collection("instructors");

    const classCollection = client.db("magicDanceArts").collection("classes");

    const selectedCollection = client
      .db("magicDanceArts")
      .collection("selected");

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
    // get approved classes
    app.get("/approvedClasses", async (req, res) => {
      const result = await classCollection
        .find({ status: "approved" })
        .toArray();
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
    // app.get("/instructors", async (req, res) => {
    //   const result = await instructorCollection.find().toArray();
    //   res.send(result);
    // });

    app.get("/instructors", async (req, res) => {
      try {
        const result = await userCollection
          .find({ role: "instructor" })
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error retrieving instructors:", error);
        res.status(500).send("An error occurred while retrieving instructors.");
      }
    });

    // selected class get
    app.get("/selectedClasses", async (req, res) => {
      const result = await selectedCollection.find().toArray();
      res.send(result);
    });
    // selected classes get by id
    app.get("/mySelectedClasses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.findOne(query);
      res.send(result);
    });
    app.post("/selectedClasses", async (req, res) => {
      const user = req.body;
      const query = { classId: user.classId };
      const existingClass = await selectedCollection.findOne(query);
      if (existingClass) {
        res.status(400).send({ message: "Class already exists!" });
      } else {
        const result = await selectedCollection.insertOne(user);
        res.send(result);
      }
    });

    // deleted selected classes
    app.delete("/selectedClasses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(query);
      res.send(result);
    });

    // Stripe payment
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment related api
    // app.post("/payments", verifyJWT, async (req, res) => {
    //   const payment = req.body;
    //   const insertResult = await paymentCollection.insertOne(payment);
    //   const query = { _id: new ObjectId(payment.classesId) };
    //   const deleteResult = await selectedCollection.deleteOne(query);
    //   res.send({ insertResult, deleteResult });
    // });

    // payment history
    app.get("/payments/:email", async (req, res) => {
      const email = req.params.email;
      const result = await paymentCollection
        .find({ email: email })
        .sort({ date: -1 }) // Sort by date in ascending order
        .toArray();
      res.send(result);
    });
    // payment related api
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
      const query = { _id: new ObjectId(payment.classesId) };
      const deleteResult = await selectedCollection.deleteOne(query);
      const updatedClass = await classCollection.findOneAndUpdate(
        { _id: new ObjectId(payment.classClassId) },
        { $inc: { enrolled_students: 1, available_seats: -1 } },
        { returnOriginal: false }
      );
      res.send({ insertResult, deleteResult, updatedClass });
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
