#!/bin/bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pricemymeds.co.uk","password":"ChangeMeNow123!"}'