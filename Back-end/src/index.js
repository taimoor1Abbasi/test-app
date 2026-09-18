import express from 'express';
import "dotenv/config"

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log(process.env.DB_URL);
app.listen(PORT, () =>     console.log(`Server is running on port ${PORT}`));
