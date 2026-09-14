import mainHtml from '../data/blog-listing/main.html?raw';

const postsContainerPattern =
  /^([\s\S]*?<div class="elementor-posts-container elementor-posts elementor-posts--skin-classic elementor-grid" role="list">)\s*(?:<article[\s\S]*?<\/article>\s*)*(<\/div>)([\s\S]*)$/;

export function getBlogListingShell(): {
  before: string;
  postsContainerClose: string;
  after: string;
} {
  const match = mainHtml.match(postsContainerPattern);
  if (!match) {
    throw new Error('Could not split blog listing main.html for pagination');
  }

  return {
    before: match[1],
    postsContainerClose: match[2],
    after: match[3],
  };
}
