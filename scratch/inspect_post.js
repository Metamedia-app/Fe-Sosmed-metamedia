const BASE_URL = 'https://besosmed-production.up.railway.app/api/v1';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZGIzNTQ4ZmYzMDZjZGVkMTg0MTIxMSIsIm5pbSI6IjIyNTUyMDIxMTAwMiIsIm5hbWEiOiJFZHkgU3lhZnJpYW50byIsInByb2dyYW1fc3R1ZGkiOiJTMSBJbmZvcm1hdGlrYSIsInN0YXR1c19tYWhhc2lzd2EiOiJBS1RJRiIsImlhdCI6MTc3NjI3MDc0NywiZXhwIjoxNzc4ODYyNzQ3fQ.4y5WTV6IiY2SG6eChUT7m7XsBPjnO9humiPU66DHrhg';

async function testGetPosts() {
  try {
    const response = await fetch(`${BASE_URL}/posts?limit=1`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });
    const result = await response.json();
    console.log('Post Object Keys:', Object.keys(result.data.posts[0]));
    console.log('_id:', result.data.posts[0]._id);
    console.log('id:', result.data.posts[0].id);
  } catch (error) {
    console.error('Error:', error);
  }
}

testGetPosts();
