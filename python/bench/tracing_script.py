import os
os.environ["LANGCHAIN_PROJECT"] = "llm_messages_test_py"
os.environ["LANGSMITH_USE_PYO3_CLIENT"] = "true"

from langsmith import traceable

@traceable
def format_prompt(subject):
  return [
      {
          "role": "system",
          "content": "You are a helpful assistant.",
      },
      {
          "role": "user",
          "content": f"What's a good name for a store that sells {subject}?"
      }
  ]

@traceable(run_type="llm")
def invoke_llm(messages):
  return {
      "choices": [
          {
              "message": {
                  "role": "assistant",
                  "content": "Sure, how about 'Rainbow Socks'?"
              }
          }
      ]
}

@traceable
def parse_output(response):
  return response["choices"][0]["message"]["content"]

@traceable
def run_pipeline():
  messages = format_prompt("colorful socks")
  response = invoke_llm(messages)
  return parse_output(response)

if __name__ == "__main__":
    run_pipeline()