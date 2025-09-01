I# PriceMyMeds Backend - Render Deployment Guide

## Prerequisites

1. **GitHub Repository**: Push your backend code to a GitHub repository
2. **MongoDB Atlas Account**: Set up a MongoDB Atlas cluster (free tier available)
3. **Render Account**: Sign up at https://render.com (free tier available)

## Step 1: Prepare MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster if you haven't already
3. Click "Connect" on your cluster
4. Add your IP address or select "Allow access from anywhere" (0.0.0.0/0)
5. Create a database user with a strong password
6. Choose "Connect your application"
7. Copy the connection string (it looks like: `mongodb+srv://<username>:<password>@cluster.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority`)
8. Replace `<username>`, `<password>`, and `<dbname>` with your actual values

## Step 2: Prepare Your Backend Code

1. Ensure your repository structure includes:
   ```
   backend/
   ├── src/
   │   └── server.js
   ├── package.json
   ├── package-lock.json
   └── render.yaml
   ```

2. Verify your `render.yaml` is properly configured (already done)

3. Create a `.env.example` file for reference:
   ```env
   NODE_ENV=production
   MONGO_URI=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/pricemymeds?retryWrites=true&w=majority
   JWT_SECRET=your-jwt-secret-here
   PORT=10000
   ```

## Step 3: Deploy to Render

### Option A: Using render.yaml (Recommended)

1. Push your code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New +" → "Blueprint"
4. Connect your GitHub account if not already connected
5. Select your repository
6. Render will detect your `render.yaml` file automatically
7. Click "Apply"

### Option B: Manual Setup

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: pricemymeds-backend
   - **Region**: Choose closest to your users
   - **Branch**: main (or your default branch)
   - **Root Directory**: backend (if backend is in a subdirectory)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (for testing) or Starter ($7/month for production)

## Step 4: Configure Environment Variables

In the Render Dashboard for your service:

1. Go to "Environment" tab
2. Add the following environment variables:

   | Key | Value | Notes |
   |-----|-------|-------|
   | `NODE_ENV` | `production` | Required |
   | `MONGO_URI` | Your MongoDB connection string | Required - Keep this secret! |
   | `JWT_SECRET` | Click "Generate" or provide your own | Required - Used for authentication |
   | `PORT` | `10000` | Render's default, don't change |

3. Click "Save Changes"

## Step 5: Deploy

1. After saving environment variables, Render will automatically trigger a deployment
2. Monitor the deployment in the "Events" tab
3. Check the logs in the "Logs" tab for any errors
4. Once deployed, you'll get a URL like: `https://pricemymeds-backend.onrender.com`

## Step 6: Test Your Deployment

1. Test the health endpoint:
   ```bash
   curl https://your-service-name.onrender.com/health
   ```

2. Test API endpoints:
   ```bash
   # Get categories
   curl https://your-service-name.onrender.com/api/categories
   
   # Get medications
   curl https://your-service-name.onrender.com/api/medications
   ```

## Step 7: Update Frontend Configuration

Update your frontend to point to the new backend URL:

1. In your frontend `.env` or configuration:
   ```env
   REACT_APP_API_URL=https://pricemymeds-backend.onrender.com/api
   ```

2. Update CORS settings if needed (already configured in server.js for pricemymeds.co.uk)

## Important Notes

### Free Tier Limitations
- **Spin-down**: Free services spin down after 15 minutes of inactivity
- **First request delay**: After spin-down, first request takes ~30 seconds
- **Solution**: Upgrade to paid tier ($7/month) for always-on service

### Security Checklist
- ✅ Never commit `.env` files to GitHub
- ✅ Use strong JWT secrets (Render can generate these)
- ✅ Restrict MongoDB Atlas IP access in production
- ✅ Enable HTTPS (Render does this automatically)
- ✅ Rate limiting is already configured
- ✅ CORS is configured for your domain

### Monitoring
- Check "Metrics" tab for CPU, Memory usage
- Set up alerts in Render Dashboard
- Monitor MongoDB Atlas metrics

### Custom Domain (Optional)
1. Go to service Settings → Custom Domains
2. Add your domain (e.g., api.pricemymeds.co.uk)
3. Update DNS records as instructed by Render

## Troubleshooting

### MongoDB Connection Issues
- Verify MongoDB Atlas network access settings
- Check connection string format
- Ensure database user has correct permissions

### Build Failures
- Check package-lock.json is committed
- Verify Node version compatibility
- Check logs for specific error messages

### CORS Errors
- Verify frontend URL in server.js CORS configuration
- Check if frontend is using correct API URL

## Admin Setup

After deployment, create your first admin user:

1. SSH into Render service or use Render Shell
2. Run the admin setup script:
   ```bash
   node scripts/reset-admin-password.js
   ```

## Support

For Render-specific issues:
- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)

For MongoDB Atlas issues:
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com)