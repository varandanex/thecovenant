import Image from "next/image";
import type { ContentSection } from "../lib/types";

export function RichContent({ sections }: { sections: ContentSection[] }) {
  return (
    <article className="prose-custom space-y-12">
      {sections.map((section, index) => {
        if (section.type === "paragraph") {
          return <p key={index}>{section.text}</p>;
        }

        if (section.type === "heading") {
          return (
            <h2 key={index} className="text-4xl">
              {section.text}
            </h2>
          );
        }

        if (section.type === "quote") {
          return <blockquote key={index}>{section.text}</blockquote>;
        }

        if (section.type === "image") {
          return section.url ? (
            <figure key={index} className="space-y-4">
              <div className="relative mx-auto aspect-[16/9] w-full overflow-hidden rounded-3xl">
                <Image
                  src={section.url}
                  alt={section.alt ?? ""}
                  fill
                  sizes="(max-width: 1024px) 100vw, 900px"
                  className="object-cover"
                />
              </div>
              {section.caption ? <figcaption className="text-sm text-muted-foreground">{section.caption}</figcaption> : null}
            </figure>
          ) : null;
        }

        if (section.type === "embed") {
          return (
            <div
              key={index}
              className="rounded-3xl border border-white/5 bg-accent/80 p-6"
              dangerouslySetInnerHTML={{ __html: section.html }}
            />
          );
        }

        return null;
      })}
    </article>
  );
}
