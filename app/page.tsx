import { HeroSection } from "./(site)/sections/hero-section";
import { ArticlesMosaic } from "./(site)/sections/articles-mosaic";

export default function HomePage() {
  return (
    <div className="space-y-24 pb-12">
      <HeroSection />
      <ArticlesMosaic />
    </div>
  );
}
