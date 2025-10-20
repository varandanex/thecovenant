import { parseDbArticle } from "../app/(site)/lib/parse-db-article.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function testParseBasic() {
  const input = {
    slug: "test-slug",
    title: "Título",
    sections: JSON.stringify([{ type: "paragraph", text: "Hola" }]),
    tags: JSON.stringify(["a", "b"]),
    coverImageUrl: "https://www.thecovenant.es/img/ejemplo.jpg",
    coverImageAlt: "Alt texto",
    publishedAt: new Date("2024-01-01T12:00:00Z"),
    readingTime: "3m"
  };
  const article = parseDbArticle(input);
  assert(article.slug === "test-slug", "slug incorrecto");
  assert(article.title === "Título", "title incorrecto");
  assert(Array.isArray(article.sections) && article.sections.length === 1, "sections no parseado");
  assert(article.sections[0].type === "paragraph", "tipo de sección erróneo");
  assert(article.tags && article.tags.length === 2 && article.tags[0] === "a", "tags incorrectos");
  assert(article.coverImage && article.coverImage.url.includes("/images/"), "coverImage normalización falló");
  assert(article.publishedAt === "2024-01-01T12:00:00.000Z", "publishedAt no ISO correcto");
}

function testFallbackSections() {
  const input = { slug: "s", title: "T", sections: "[]" };
  const article = parseDbArticle(input);
  assert(article.sections.length === 1 && article.sections[0].type === "paragraph", "fallback de sections no aplicado");
}

function testEscapeRoomParsing() {
  const input = {
    slug: "er",
    title: "Escape Room",
    sections: "[]",
    escapeRoomGeneralData: JSON.stringify({ category: "terror", durationMinutes: 70 }),
    escapeRoomScoring: JSON.stringify({ difficulty: { value: 4, max: 5, ratio: 0.8, label: "Dif" } })
  };
  const article = parseDbArticle(input);
  assert(article.escapeRoomGeneralData && article.escapeRoomGeneralData.category === "terror", "No parseó general data");
  assert(article.escapeRoomScoring && article.escapeRoomScoring.difficulty.value === 4, "No parseó scoring");
}

function testTagsNonJson() {
  const input = { slug: "s", title: "T", sections: "[]", tags: "not-json" };
  const article = parseDbArticle(input);
  assert(!article.tags, "tags debía ser undefined si no parsea JSON");
}

function runAll() {
  testParseBasic();
  testFallbackSections();
  testEscapeRoomParsing();
  testTagsNonJson();
  console.log("content-db.test.mjs: todas las pruebas pasaron");
}

runAll();
