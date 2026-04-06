import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
  const response = await client.responses.create({
    model: "gpt-5.4",
    input: "Responde apenas: ligação OK",
  });

  console.log("RESPOSTA:");
  console.log(response.output_text);
}

main().catch((err) => {
  console.error("ERRO OPENAI:");
  console.error(err);
  process.exit(1);
});
