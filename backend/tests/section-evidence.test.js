const { test } = require('node:test');
const assert = require('node:assert/strict');
const parse = require('../src/services/parse-evidence');

test('section candidates work for all six registered platform names', () => {
  for (const platform of ['facebook', 'twitter', 'instagram', 'telegram', 'whatsapp', 'google']) {
    const profile = parse('Name: Sample Person\nBio: Fictional training account\nUnlabelled heading', { platform, section: 'account_info' });
    assert.equal(profile.profileFields.length, 2);
    assert.equal(profile.profileFields[0].value, 'Sample Person');
    const people = parse('Followers\n120 followers\nSample Person @sample_user\n@another_user\nFollow', { platform, section: 'followers' });
    assert.equal(people.people.length, 2);
    assert.equal(people.people[0].displayName, 'Sample Person');
    assert.equal(people.people[0].lineNumber, 3);
    const posts = parse('Post: First line\nSecond line\nAuthor: @sample_user\nDate: 27 November 2026\nShare\nPost: Next post', { platform, section: 'posts' });
    assert.equal(posts.posts.length, 2);
    assert.equal(posts.posts[0].text, 'First line\nSecond line');
    assert.equal(posts.posts[0].author, '@sample_user');
    assert.equal(posts.posts[0].displayedDate, '27 November 2026');
  }
});
test('unrecognized content is not promoted to a structured post or person', () => {
  assert.deepEqual(parse('Unlabelled content\n100 likes', { platform: 'instagram', section: 'posts' }).posts, []);
  assert.deepEqual(parse('Alice\nBob\nFollowers', { platform: 'instagram', section: 'friends' }).people, []);
  assert.equal(parse('Name: Alice', { platform: 'unknown', section: 'account_info' }).profileFields, undefined);
});
