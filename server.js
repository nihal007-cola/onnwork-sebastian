import express from "express";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Sebastian server is running 🚀");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
