const TOKEN_TYPES = {
  WORD: "word",
  STRING: "string",
  NUMBER: "number",
  VAR_STRING: "var_string",
  VAR_NUMBER: "var_number",
};

const RESERVED_WORDS = {
  PRINT: "PRINT",
  CLS: "CLS",
  END: "END",
  GOTO: "GOTO",
  VARIABLE: "VARIABLE",
  IF: "IF",
  THEN: "THEN",
};

const COMPARATORS = ["=", "<", ">"];

let globalVariables = {};

const detectTabSpaces = (lines) =>
  lines.map((line) => line.replace("  ", " /t"));

export const lexer = (code) => {
  let lines = code.split("\n");

  lines = detectTabSpaces(lines);

  return lines.map((line) =>
    line
      .split(/ +(?=(?:(?:[^"]*"){2})*[^"]*$)/g)
      .filter((l) => l.length > 0)
      .map((token) => {
        if (!isNaN(token))
          return { type: TOKEN_TYPES.NUMBER, value: parseInt(token) };

        if (token.includes('"')) {
          const removeQuotes = /(['"])(?:\\?[\s\S])*?\1/g;
          const tokenOutsideQuotes = token.replace(removeQuotes, "");

          if (tokenOutsideQuotes.includes("$")) {
            return {
              type: TOKEN_TYPES.VAR_STRING,
              value: clearToken(token),
            };
          } else {
            return {
              type: TOKEN_TYPES.STRING,
              value: clearToken(token),
            };
          }
        } else if (token.includes("%")) {
          return {
            type: TOKEN_TYPES.VAR_NUMBER,
            value: clearToken(token),
          };
        } else {
          return { type: TOKEN_TYPES.WORD, value: clearToken(token) };
        }
      })
  );
};

const clearToken = (token) => token.replace(/['"]+/g, "").replace("\r", "");

const processTokens = (tokens, tokensLength, lineObject, lines) => {
  try {
    // extract a token at a time as current_token. Loop until we are out of tokens.
    while (tokens.length > 0) {
      const isLineNumber = tokens.length === tokensLength;
      const current_token = tokens.shift();

      if (isLineNumber && current_token.type === TOKEN_TYPES.NUMBER) {
        lineObject.number = current_token.value;
        continue;
      } else if (isLineNumber) {
        throw new Error("Line number must be a number");
      }

      switch (current_token.type) {
        case TOKEN_TYPES.WORD: {
          if (current_token.type === TOKEN_TYPES.WORD) {
            switch (current_token.value) {
              case RESERVED_WORDS.PRINT: {
                const expression = {
                  type: "CallExpression",
                  name: RESERVED_WORDS.PRINT,
                  arguments: [],
                };

                // if current token is CallExpression of type PRINT, next token should be number/string argument
                const argument = tokens.shift();

                if (argument.type === TOKEN_TYPES.WORD) {
                  const variable = globalVariables[argument.value];

                  if (!variable)
                    throw new Error(
                      `Variable ${argument.value} cannot be accessed before initialization.`
                    );

                  expression.arguments.push({
                    type: "Variable",
                    value: argument.value,
                  });

                  lineObject.content.push(expression);

                  break;
                }

                if (
                  argument.type === TOKEN_TYPES.NUMBER ||
                  argument.type === TOKEN_TYPES.STRING
                ) {
                  expression.arguments.push({
                    type: "NumberOrString",
                    value: argument.value,
                  });

                  lineObject.content.push(expression);
                  break;
                }

                throw new Error(
                  "PRINT command must be followed by a number/string/variable."
                );
              }

              case RESERVED_WORDS.CLS: {
                const expression = {
                  type: "CallExpression",
                  name: RESERVED_WORDS.CLS,
                };

                if (tokens.length > 0) {
                  throw new Error(
                    "CLS command must not be followed by anything."
                  );
                }

                lineObject.content.push(expression); // push the expression object to body of our AST
                break;
              }

              case RESERVED_WORDS.END: {
                const expression = {
                  type: "CallExpression",
                  name: RESERVED_WORDS.END,
                };

                if (tokens.length > 0) {
                  throw new Error(
                    "END command must not be followed by anything."
                  );
                }

                lineObject.content.push(expression); // push the expression object to body of our AST
                break;
              }

              case RESERVED_WORDS.GOTO: {
                const expression = {
                  type: "CallExpression",
                  name: RESERVED_WORDS.GOTO,
                  arguments: [],
                };

                const argument = tokens.shift();

                if (
                  argument &&
                  argument.type === TOKEN_TYPES.NUMBER &&
                  tokens.length === 0
                ) {
                  expression.arguments.push({
                    // add argument information to expression object
                    type: "Number",
                    value: argument.value,
                  });
                  lineObject.content.push(expression); // push the expression object to body of our AST
                } else {
                  throw new Error(
                    "GOTO command must be followed only by a number."
                  );
                }
                break;
              }

              case RESERVED_WORDS.IF: {
                const expression = {
                  type: "CallExpression",
                  name: RESERVED_WORDS.IF,
                  arguments: [],
                };

                const conditionToken = tokens.shift();

                if (
                  (conditionToken &&
                    conditionToken.type === TOKEN_TYPES.WORD) ||
                  conditionToken.type === TOKEN_TYPES.STRING
                ) {
                  if (
                    !COMPARATORS.some((comparator) =>
                      conditionToken.value.includes(comparator)
                    )
                  ) {
                    throw new Error(
                      "IF command must have a condition with a comparator."
                    );
                  }
                  expression.arguments.push({
                    type: "Condition",
                    value: conditionToken.value,
                  });
                }

                const thenToken = tokens.shift();
                if (thenToken && thenToken.type === TOKEN_TYPES.WORD) {
                  if (thenToken.value !== RESERVED_WORDS.THEN) {
                    throw new Error("IF command must have a THEN statement.");
                  }

                  const goToLineToken = tokens.shift();

                  if (goToLineToken) {
                    expression.arguments.push({
                      type: "Then",
                      value: goToLineToken?.value,
                    });
                  } else {
                    expression.arguments.push({
                      type: "Then",
                      value: [],
                    });

                    // Check next line
                    while (lines[0][1].value.includes("/t")) {
                      const nextLineTokens = lines.shift().map((token) => {
                        if (
                          typeof token.value === "string" &&
                          token.value.includes("/t")
                        ) {
                          return {
                            ...token,
                            value: token.value.replace("/t", ""),
                          };
                        } else {
                          return token;
                        }
                      });

                      const nextLineObject = {
                        number: 0,
                        content: [],
                      };

                      processTokens(
                        nextLineTokens,
                        nextLineTokens.length,
                        nextLineObject,
                        lines
                      );

                      expression.arguments[1].value.push(nextLineObject);
                    }

                    if (expression.arguments[1].value.length === 0) {
                      throw new Error("Then statement is empty");
                    }
                  }
                }

                lineObject.content.push(expression);
                break;
              }
            }
          }
          break;
        }

        case TOKEN_TYPES.VAR_NUMBER: {
          const splittedValue = current_token.value.split("%=");

          if (splittedValue.length === 2) {
            const isNotANumber = isNaN(splittedValue[1]);
            if (isNotANumber)
              throw new Error(
                `Variable value of type NUMBER unexpected for variable named '${splittedValue[0]}'`
              );

            globalVariables = {
              ...globalVariables,
              [splittedValue[0]]: splittedValue[1],
            };
          } else {
            throw new Error(
              `Variable declaration unexpected for variable named '${splittedValue[0]}'`
            );
          }
          break;
        }

        case TOKEN_TYPES.VAR_STRING: {
          const splittedValue = current_token.value.split("$=");

          if (splittedValue.length === 2) {
            const isNotANumber = isNaN(splittedValue[1]);
            if (!isNotANumber)
              throw new Error(
                `Variable value of type STRING unexpected for variable named '${splittedValue[0]}'`
              );

            globalVariables = {
              ...globalVariables,
              [splittedValue[0]]: splittedValue[1],
            };
          } else {
            throw new Error(
              `Variable declaration unexpected for variable named '${splittedValue[0]}'`
            );
          }
          break;
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
};

export const parser = (lines) => {
  // Abstract syntax tree
  const AST = {
    type: "BASIC",
    body: [],
  };

  while (lines.length > 0) {
    const tokens = lines.shift();
    const tokensLength = tokens.length;
    const lineObject = {
      number: 0,
      content: [],
    };

    processTokens(tokens, tokensLength, lineObject, lines);

    if (lineObject.content.length > 0) AST.body.push(lineObject);
  }

  return AST;
};

export const generator = (basic_ast) => {
  const body = basic_ast.body;
  let index = 0;
  let count = 0;

  // console.clear();

  try {
    while (index !== -1) {
      const content = body[index]?.content;

      if (!content) return;

      const result = executeContent(content, globalVariables);

      if (result && !isNaN(result)) {
        const indexFound = body.find((line) => line.number === result);
        if (!indexFound)
          throw new Error(`Not possible to go to line ${result}, not found`);

        index = body.indexOf(indexFound);
        continue;
      } else if (result) {
        throw new Error(`Not possible to go to line ${result}`);
      }

      index++;

      // Emergency stop for infinite loop
      count++;
      if (count === 100) {
        throw new Error("Infinite loop prevented");
      }
    }
  } catch (e) {
    console.log(e);
  }
};

const executeContent = (content) => {
  let result;
  content.forEach((statement) => {
    const name = statement.name;
    switch (name) {
      case RESERVED_WORDS.PRINT:
        const argument = statement.arguments[0];

        const value =
          argument.type === "Variable"
            ? globalVariables[argument.value]
            : argument.value;

        console.log(value);
        break;

      case RESERVED_WORDS.CLS:
        console.clear();
        break;

      case RESERVED_WORDS.END:
        throw "- End of execution -";

      case RESERVED_WORDS.GOTO:
        result = statement.arguments[0].value;
        break;

      case RESERVED_WORDS.IF:
        const args = statement.arguments;
        const conditionResult = performCondition(args[0]);
        if (conditionResult) {
          if (args[1] && args[1].value) {
            if (!isNaN(args[1].value)) {
              result = args[1].value;
            } else {
              args[1].value.forEach((value) => {
                result = executeContent(value.content);
              });
            }
          }
        }
        break;
    }
  });

  return result;
};

const performCondition = (conditionToken) => {
  const conditionValue = conditionToken.value;

  let comparator = COMPARATORS.find((comparator) =>
    conditionValue.includes(comparator)
  );
  if (comparator === "=") comparator = "===";

  const splittedCondition = splitCondition(conditionValue);

  const param1 = getValue(splittedCondition[0]);
  const param2 = getValue(splittedCondition[1]);

  return eval(param1 + comparator + param2);
};

const getValue = (value) => {
  if (!isNaN(value)) return value;

  return globalVariables[value] || value;
};

const splitCondition = (condition) => condition.split(/[=><]+/);
