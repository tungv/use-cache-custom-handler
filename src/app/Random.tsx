import { connection } from "next/server";

export default async function Random() {
  const randomNumber = await getRandomNumber();
  return <div>{randomNumber}</div>;
}

async function getRandomNumber() {
  "use cache: my_handler";
  return Math.random();
}
