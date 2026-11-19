/**
 * Produces the assistant's reply to a user message.
 *
 * The SADS AI agent is not integrated yet, so this returns the same
 * placeholder the extension host used to produce locally. It lives on the
 * server so assistant messages are always authored by the backend; clients
 * can only ever create USER messages.
 */
export const assistantResponder = {
  async reply(input: { content: string }): Promise<string> {
    return (
      `I received your request:\n\n"${input.content}"\n\n` +
      "The React chat UI is connected to the SADS backend and this " +
      "conversation is saved. The AI agent will be integrated in a later phase."
    );
  },
};
