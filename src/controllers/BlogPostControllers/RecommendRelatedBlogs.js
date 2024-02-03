const TfIdf = require('node-tfidf');
const BlogPost = require('../../models/BlogPostModel');

const recommendRelatedPosts = async (req, res) => {
    const currentPostId = req.query.postId;

    if (!currentPostId) {
        return res.status(400).send('No post id specified');
    }

    try {
        const currentPost = await BlogPost.findById(currentPostId);

        if (!currentPost) {
            return res.status(404).send('Post not found');
        }

        const currentContent = currentPost.content || '';

        // Retrieve other blog posts from the database with a limit
        const allPosts = await BlogPost.find({ _id: { $ne: currentPostId } }).limit(100);

        const tfidf = new TfIdf();

        // Learn documents from other posts asynchronously
        await Promise.all(allPosts.map(async (post, index) => {
            await tfidf.addDocument(post.content, index);
        }));

        // Learn the current document
        tfidf.addDocument(currentContent, 'current');

        // Calculate similarities asynchronously
        const similarityPromises = allPosts.map(async (post, index) => {
            const similarity = await tfidf.tfidf(currentContent, index);
            return { post, similarity };
        });

        const similarities = await Promise.all(similarityPromises);

        // Sort by similarity in descending order
        similarities.sort((a, b) => b.similarity - a.similarity);

        const initialThreshold = 1.0;

        // Filter and map in a single step, limiting to 2 related posts
        const relatedPosts = similarities
            .filter((item) => item.similarity >= initialThreshold)
            .map((item) => item.post)
            .slice(0, 5); // Limiting to 5 related posts

        return res.send(relatedPosts);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = recommendRelatedPosts;