const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  excerpt: {
    type: String,
    required: true,
    maxLength: 300
  },
  content: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true,
    default: 'PriceMyMeds Team'
  },
  category: {
    type: String,
    required: true,
    enum: ['Weight Loss', 'Men\'s Health', 'Women\'s Health', 'Hair Loss', 'Money Saving', 'General Health']
  },
  tags: [{
    type: String,
    trim: true
  }],
  featuredImage: {
    type: String,
    default: '/images/blog-placeholder.jpg'
  },
  metaDescription: {
    type: String,
    required: true,
    maxLength: 160
  },
  metaKeywords: [{
    type: String,
    trim: true
  }],
  readTime: {
    type: Number,
    default: 5
  },
  published: {
    type: Boolean,
    default: false
  },
  publishDate: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Auto-generate slug from title if not provided
blogPostSchema.pre('save', function(next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  
  // Calculate read time based on content length (200 words per minute)
  if (this.content) {
    const wordCount = this.content.split(/\s+/).length;
    this.readTime = Math.ceil(wordCount / 200);
  }
  
  this.lastUpdated = Date.now();
  next();
});

// Index for better search performance
blogPostSchema.index({ slug: 1 });
blogPostSchema.index({ published: 1, publishDate: -1 });
blogPostSchema.index({ category: 1 });
blogPostSchema.index({ tags: 1 });

module.exports = mongoose.model('BlogPost', blogPostSchema);