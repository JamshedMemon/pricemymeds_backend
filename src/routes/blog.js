const express = require('express');
const router = express.Router();
const BlogPost = require('../models/BlogPost');
const { verifyToken } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');

// Admin middleware
const authenticateToken = verifyToken;
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Helper to log activities
const logActivity = (action) => {
  return async (req, res, next) => {
    // Log after successful operation
    const originalJson = res.json;
    res.json = function(data) {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        logAction(req, action, 'blog_post', req.params.id || data?.data?._id, req.body);
      }
      originalJson.call(res, data);
    };
    next();
  };
};

// Get all published blog posts (public)
router.get('/posts', async (req, res) => {
  try {
    const { category, limit = 10, offset = 0 } = req.query;
    
    const query = { published: true };
    if (category) {
      query.category = category;
    }
    
    const posts = await BlogPost.find(query)
      .sort({ publishDate: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .select('-__v');
    
    const total = await BlogPost.countDocuments(query);
    
    res.json({
      success: true,
      data: posts,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch blog posts' 
    });
  }
});

// Get single blog post by slug (public)
router.get('/posts/:slug', async (req, res) => {
  try {
    const post = await BlogPost.findOne({ 
      slug: req.params.slug, 
      published: true 
    }).select('-__v');
    
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Blog post not found' 
      });
    }
    
    res.json({ success: true, data: post });
  } catch (error) {
    console.error('Error fetching blog post:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch blog post' 
    });
  }
});

// Get related posts (public)
router.get('/posts/:slug/related', async (req, res) => {
  try {
    const currentPost = await BlogPost.findOne({ 
      slug: req.params.slug 
    });
    
    if (!currentPost) {
      return res.status(404).json({ 
        success: false, 
        message: 'Blog post not found' 
      });
    }
    
    const relatedPosts = await BlogPost.find({
      _id: { $ne: currentPost._id },
      published: true,
      $or: [
        { category: currentPost.category },
        { tags: { $in: currentPost.tags } }
      ]
    })
    .limit(3)
    .sort({ publishDate: -1 })
    .select('slug title excerpt category publishDate readTime');
    
    res.json({ success: true, data: relatedPosts });
  } catch (error) {
    console.error('Error fetching related posts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch related posts' 
    });
  }
});

// Admin routes - require authentication
// Get all blog posts including drafts (admin)
router.get('/admin/posts', authenticateToken, isAdmin, async (req, res) => {
  try {
    const posts = await BlogPost.find()
      .sort({ createdAt: -1 })
      .select('-content -__v');
    
    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('Error fetching admin blog posts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch blog posts' 
    });
  }
});

// Get single blog post for editing (admin)
router.get('/admin/posts/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Blog post not found' 
      });
    }
    
    res.json({ success: true, data: post });
  } catch (error) {
    console.error('Error fetching blog post:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch blog post' 
    });
  }
});

// Create new blog post (admin)
router.post('/admin/posts', authenticateToken, isAdmin, logActivity('create_blog_post'), async (req, res) => {
  try {
    const postData = {
      ...req.body,
      author: req.user.username || 'Admin'
    };
    
    const post = new BlogPost(postData);
    await post.save();
    
    res.status(201).json({ 
      success: true, 
      data: post,
      message: 'Blog post created successfully' 
    });
  } catch (error) {
    console.error('Error creating blog post:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'A post with this slug already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create blog post',
      error: error.message 
    });
  }
});

// Update blog post (admin)
router.put('/admin/posts/:id', authenticateToken, isAdmin, logActivity('update_blog_post'), async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndUpdate(
      req.params.id,
      { 
        ...req.body,
        lastUpdated: Date.now()
      },
      { new: true, runValidators: true }
    );
    
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Blog post not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: post,
      message: 'Blog post updated successfully' 
    });
  } catch (error) {
    console.error('Error updating blog post:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update blog post',
      error: error.message 
    });
  }
});

// Delete blog post (admin)
router.delete('/admin/posts/:id', authenticateToken, isAdmin, logActivity('delete_blog_post'), async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndDelete(req.params.id);
    
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Blog post not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Blog post deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete blog post' 
    });
  }
});

// Toggle publish status (admin)
router.patch('/admin/posts/:id/publish', authenticateToken, isAdmin, logActivity('toggle_blog_publish'), async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Blog post not found' 
      });
    }
    
    post.published = !post.published;
    if (post.published && !post.publishDate) {
      post.publishDate = Date.now();
    }
    
    await post.save();
    
    res.json({ 
      success: true, 
      data: post,
      message: `Blog post ${post.published ? 'published' : 'unpublished'} successfully` 
    });
  } catch (error) {
    console.error('Error toggling publish status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to toggle publish status' 
    });
  }
});

module.exports = router;