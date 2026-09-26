export default function Home() {
  const mark = process.env.UT_MARK ?? 'default';
  return (
    <>
      <h1>next-app ok</h1>
      <p>ut-mark:{mark}</p>
    </>
  );
}
