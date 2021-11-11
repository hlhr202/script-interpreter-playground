const source = `function test() {
    let a = 1;
    let b = 2;
    return a + b;
}

test();
`;

type Token = { token: string; string: string };

const rules: [string, RegExp][] = [
    ["FUNCTION_KEYWORD", /^function/],
    ["RETURN_KEYWORD", /^return/],
    ["LET_KEYWORD", /^let/],

    ["NUMBER", /^\d+(\.\d+)?/],
    ["WORD", /^\w+/],
    ["SPACE", /^\s{1,}/],
    ["SEMI", /^;/],
    ["LINE_BREAK", /^(\r\n|\n|\r)/],
    ["BRACE", /^(\{|\})/],
    ["PAREN", /^(\(|\))/],
    ["PUNCTUATOR", /^(=|\+)/],
];

const tokenize = (source: string) => {
    let tokens: Token[] = [];
    let rest = source;
    while (rest.length) {
        let matchSomeRule = false;
        for (let [name, reg] of rules) {
            const matched = rest.match(reg);
            if (matched) {
                matchSomeRule = true;
                const remainder =
                    rest.substring(0, matched.index) +
                    rest.substring(matched[0].length);
                rest = remainder;
                tokens.push({ token: name, string: matched[0] });
                break;
            }
        }
        if (!matchSomeRule) {
            const str = rest[0];
            rest = rest.substring(0, 1);
            tokens.push({ token: "OTHER", string: str });
            break;
        }
    }
    return tokens;
};

interface IExpression {
    type: string;
    callee?: string;
    notation?: Token[];
}

interface INode {
    type: string;
    identifier?: string;
    expression?: IExpression;
    body?: INode[];
}

class Parser {
    current = 0;

    constructor(public tokens: Token[]) {}

    eat() {
        this.current += 1;
    }
    getToken(x: number = 0): Token | undefined {
        return this.tokens[this.current + x];
    }

    parseFunction() {
        let identifier: string = "";
        while (this.getToken()?.string !== "(") {
            identifier += this.getToken()!.string;
            this.eat();
        }
        identifier = identifier.trim();
        while (this.getToken()?.string !== "{") {
            this.eat();
        }
        this.eat(); // eat {
        const nodes = this.parseNode();
        return { type: "FunctionStatement", identifier, body: nodes };
    }

    parseExpression() {
        const reverseNotation: Token[] = [];
        let firstLeft: string | undefined;
        let op: Token | undefined;
        while (this.getToken()) {
            switch (this.getToken()?.token) {
                case "PUNCTUATOR": {
                    const t = this.getToken();
                    op = t!;
                    this.eat();
                    break;
                }
                case "SEMI":
                case "LINE_BREAK": {
                    this.eat();
                    return {
                        type: "BinaryExpression",
                        notation: reverseNotation,
                    };
                }
                case "PAREN": {
                    if (firstLeft && !op) {
                        if (this.getToken()?.string === "(") {
                            while (this.getToken()?.string !== ")") {
                                // TODO: parse parameter
                                this.eat();
                            }
                            this.eat();
                            return {
                                type: "CallExpression",
                                callee: firstLeft,
                            };
                        }
                    }
                    break;
                }
                case "NUMBER":
                case "WORD": {
                    if (!firstLeft) {
                        firstLeft = this.getToken()!.string;
                        reverseNotation.push(this.getToken()!);
                    } else {
                        const right = this.getToken()!;
                        if (!op) {
                            //error
                        } else {
                            reverseNotation.push(right);
                            reverseNotation.push(op);
                        }
                    }
                    this.eat();
                    break;
                }
                default:
                    this.eat();
                    break;
            }
        }
        return { type: "BinaryExpression", notation: reverseNotation };
    }

    parseAssignStatement() {
        while (this.getToken() && this.getToken()?.token !== "WORD") {
            this.eat();
        }
        const identifier = this.getToken()?.string;
        while (this.getToken() && this.getToken()?.string !== "=") {
            this.eat();
        }
        this.eat();
        const expression = this.parseExpression();
        return { type: "AssignStatement", identifier, expression };
    }

    parseNode() {
        const nodes: INode[] = [];
        while (this.getToken()) {
            switch (this.getToken()?.token) {
                case "SPACE": {
                    this.eat();
                    break;
                }
                case "FUNCTION_KEYWORD": {
                    this.eat();
                    const funcionNode = this.parseFunction();
                    nodes.push(funcionNode);
                    break;
                }
                case "RETURN_KEYWORD": {
                    this.eat();
                    const exp = this.parseExpression();
                    nodes.push({ type: "ReturnStatement", expression: exp });
                    break;
                }
                case "LET_KEYWORD": {
                    this.eat();
                    nodes.push(this.parseAssignStatement());
                    break;
                }
                case "BRACE": {
                    if (this.getToken()?.string === "}") {
                        this.eat();
                        return nodes;
                    } else {
                        this.eat();
                    }
                    break;
                }
                case "WORD": {
                    const expression = this.parseExpression();
                    nodes.push({ type: "ExpressionStatement", expression });
                    break;
                }
                default: {
                    this.eat();
                    break;
                }
            }
        }
        return nodes;
    }
}

const evaluate = (env: { [x: string]: any }, expression: IExpression) => {
    const scopedEnv = Object.assign({}, env);

    const getValueFromToken = (token: Token) => {
        switch (token.token) {
            case "WORD": {
                return scopedEnv[token.string];
            }
            case "NUMBER": {
                return Number(token.string);
            }
            default:
                return null;
        }
    };

    switch (expression.type) {
        case "CallExpression": {
            const functionStatement = scopedEnv[expression.callee!] as INode;
            return interprete(scopedEnv, functionStatement.body ?? []);
        }
        case "BinaryExpression": {
            if (expression.notation?.length === 1)
                return getValueFromToken(expression.notation[0]);
            else {
                const stack: Token[] = [];
                while (expression.notation?.length) {
                    const first = expression.notation.shift();
                    if (first?.string === "+") {
                        const [left, right] = [stack.pop(), stack.pop()];
                        const leftValue = getValueFromToken(left!);
                        const rightValue = getValueFromToken(right!);
                        stack.push({
                            token: "NUMBER",
                            string: (leftValue + rightValue).toString(),
                        });
                    } else if (
                        first?.token === "WORD" ||
                        first?.token === "NUMBER"
                    ) {
                        stack.push(first);
                    }
                }
                return getValueFromToken(stack[0]);
            }
        }
    }
};

const interprete = (env: { [x: string]: any } = {}, root: INode[]): any => {
    const scopedEnv = Object.assign({}, env);
    let last = undefined;
    for (let node of root) {
        switch (node.type) {
            case "FunctionStatement": {
                if (node.identifier) {
                    scopedEnv[node.identifier] = node;
                }
                break;
            }
            case "ExpressionStatement": {
                last = evaluate(scopedEnv, node.expression!);
                break;
            }
            case "AssignStatement": {
                scopedEnv[node.identifier!] = evaluate(
                    scopedEnv,
                    node.expression!
                );
                break;
            }
            case "ReturnStatement": {
                last = evaluate(scopedEnv, node.expression!);
            }
        }
    }
    return last;
};

const parser = new Parser(tokenize(source));
const ast = parser.parseNode();
const value = interprete({}, ast);
console.log(value);
